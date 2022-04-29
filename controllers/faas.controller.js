const router = require('express').Router();
const log4js = require('log4js');
const mongoose = require('mongoose');
// const _ = require('lodash');

const dataStackUtils = require('@appveen/data.stack-utils');

const envConfig = require('../config');
const queryUtils = require('../utils/query.utils');

const faasModel = mongoose.model('faas');
const faasDraftModel = mongoose.model('faas.draft');

const logger = log4js.getLogger('faas.controller');
const kubeutil = dataStackUtils.kubeutil;

router.get('/', async (req, res) => {
	try {
		const filter = queryUtils.parseFilter(req.query.filter);
		if (filter) {
			filter.app = req.locals.app;
		}
		if (req.query.countOnly) {
			const count = await faasModel.countDocuments(filter);
			return res.status(200).json(count);
		}
		const data = queryUtils.getPaginationData(req);
		const docs = await faasModel.find(filter).select(data.select).sort(data.sort).skip(data.skip).limit(data.count).lean();
		res.status(200).json(docs);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.get('/:id', async (req, res) => {
	try {
		let txnId = req.get('txnId');
		let draft = req.query.draft;
		let id = req.params.id;

		logger.info(`[${txnId}] Faas show request received :: ${id} :: draft :: ${draft}`);

		if (draft) {
			let draftQuery = faasDraftModel.findById(id);
			if (req.query.select) {
				draftQuery = draftQuery.select(req.query.select);
			}
			let draftDoc = await draftQuery.lean();
			if (draftDoc) {
				return res.status(200).json(draftDoc);
			}
			logger.debug(`[${txnId}] Faas draft not found in draft collection, checking in main collection`);
		}
		let mongoQuery = faasModel.findById(req.params.id);
		if (req.query.select) {
			mongoQuery = mongoQuery.select(req.query.select);
		}
		let doc = await mongoQuery.lean();
		if (!doc) {
			logger.error(`[${txnId}] Function data not found`);
			return res.status(404).json({
				message: 'Function Not Found'
			});
		}
		return res.status(200).json(doc);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.post('/', async (req, res) => {

	let txnId = req.get('TxnId');
	let socket = req.app.get('socket');
	let payload = JSON.parse(JSON.stringify(req.body));

	logger.info(`[${txnId}] Function create request received`);
	logger.trace(`[${txnId}] Function details :: ${JSON.stringify(payload)}`);
	try {
		delete payload.version;
		delete payload.draftVersion;
		delete payload.status;
		delete payload.port;
		delete payload.deploymentName;
		delete payload.namespace;
		payload.version = 1;

		logger.trace(`[${txnId}] Function create data :: ${JSON.stringify(payload)}`);

		let doc = new faasModel(payload);
		doc._req = req;
		const status = await doc.save();

		socket.emit('faasCreated', {
			app: payload.app,
			url: payload.url,
			port: payload.port,
			deploymentName: payload.deploymentName,
			namespace: payload.namespace,
			message: payload.status
		});

		res.status(200).json(status);
	} catch (err) {
		logger.error(err);

		if (payload && payload._id) {
			await faasModel.remove({ _id: payload._id });
		}
		if (!res.headersSent) {
			res.status(500).json({
				message: err.message
			});
		}
	}
});

router.put('/:id', async (req, res) => {
	try {
		let txnId = req.get('TxnId');
		let id = req.params.id;
		let socket = req.app.get('socket');
		let payload = JSON.parse(JSON.stringify(req.body));

		logger.info(`[${txnId}] Function update request received - ${id}`);

		delete payload.version;
		delete payload.draftVersion;
		delete payload.status;
		delete payload.port;
		delete payload.deploymentName;
		delete payload.namespace;
		payload._id = id;

		logger.trace(`[${txnId}] Function update data received :: ${JSON.stringify(payload)}`);

		let doc = await faasModel.findOne({ _id: req.params.id, '_metadata.deleted': false });

		if (!doc) {
			logger.error(`[${txnId}] Function data not found in b2b.faas collection`);
			return res.status(404).json({
				message: 'Function Not Found'
			});
		}

		logger.debug(`[${txnId}] Function found in b2b.faas collection for ID :: ${id}`);
		logger.trace(`[${txnId}] Function data :: ${JSON.stringify(doc)}`);

		let faasData = JSON.parse(JSON.stringify(doc));

		if (payload.app && payload.app !== doc.app) {
			logger.error(`[${txnId}] App change not permitted`);

			return res.status(400).json({
				message: 'App change not permitted'
			});
		}

		if (faasData.status === 'Draft') {
			Object.assign(doc, payload);

			logger.info(`[${txnId}] Function is in draft status`);
			logger.trace(`[${txnId}] Function data to be updated :: ${JSON.stringify(doc)}`);

			doc._req = req;
			doc.save();

		} else if (faasData.draftVersion) {

			logger.info(`[${txnId}] Function is not in draft status, but has a draft linked to it`);

			let draftData = await faasDraftModel.findOne({ _id: id, '_metadata.deleted': false });

			logger.trace(`[${txnId}] Linked function draft data found :: ${JSON.stringify(draftData)}`);
			logger.trace(`[${txnId}] New function draft data to be updated :: ${JSON.stringify(payload)}`);

			draftData = Object.assign(draftData, payload);
			draftData._req = req;
			draftData.save();

		} else {
			logger.info(`[${txnId}] Function is neither in draft status nor has a linked draft, creating a new draft`);

			let newData = new faasDraftModel(Object.assign({}, JSON.parse(JSON.stringify(doc)), payload));
			newData.version = faasData.version + 1;
			newData.status = 'Draft';
			doc.draftVersion = newData.version;

			logger.trace(`[${txnId}] Function data to be updated :: ${JSON.stringify(doc)}`);
			logger.trace(`[${txnId}] New draft function data to be created :: ${JSON.stringify(newData)}`);

			newData._req = req;
			doc._req = req;
			await newData.save();
			await doc.save();
		}

		res.status(200).json(doc.toObject());

		socket.emit('faasStatus', {
			_id: id,
			app: faasData.app,
			url: faasData.url,
			port: faasData.port,
			deploymentName: faasData.deploymentName,
			namespace: faasData.namespace,
			message: 'Updated'
		});
	} catch (err) {
		logger.error(err);
		return res.status(500).json({
			message: err.message
		});
	}
});

router.delete('/:id', async (req, res) => {
	try {
		let id = req.params.id;
		let txnId = req.get('TxnId');
		let socket = req.app.get('socket');
		logger.info(`[${txnId}] Function destroy request received :: ${id}`);

		let doc = await faasModel.findOne({ _id: req.params.id, '_metadata.deleted': false });
		if (!doc) {
			logger.error(`[${txnId}] Function data not found for id :: ${id}`);
			return res.status(404).json({
				message: 'Function Not Found'
			});
		}

		logger.info(`[${txnId}] Function data found for id :: ${id}`);
		logger.trace(`[${txnId}] Function data :: ${JSON.stringify(doc)}`);

		if (doc.status === 'Active') {
			logger.error(`[${txnId}] Function is in Active state.`);
			return res.status(400).json({ message: 'Can\'t delete while function is running' });
		}

		let draftData = await faasDraftModel.findOne({ _id: id, '_metadata.deleted': false });
		if (!draftData) {
			logger.info(`[${txnId}] Draft data not available for function :: ${id}`);
		} else {
			draftData._req = req;
			await draftData.remove();
		}

		if (envConfig.isK8sEnv()) {
			let status = await kubeutil.service.deleteService(doc.namespace, doc.deploymentName);
			logger.debug(`[${txnId}] Service deleted :: ${status.statusCode}`);
			logger.trace(`[${txnId}] Service deleted :: ${JSON.stringify(status)}`);

			status = await kubeutil.deployment.deleteDeployment(doc.namespace, doc.deploymentName);
			logger.debug(`[${txnId}] Deployment deleted :: ${status.statusCode}`);
			logger.debug(`[${txnId}] Deployment deleted :: ${JSON.stringify(status)}`);
		}

		let eventId = 'EVENT_FAAS_DELETE';
		logger.debug(`[${txnId}] Publishing Event :: ${eventId}`);
		dataStackUtils.eventsUtil.publishEvent(eventId, 'faas', req, doc, null);

		socket.emit('faasDeleted', {
			_id: id,
			app: doc.app,
			url: doc.url,
			port: doc.port,
			deploymentName: doc.deploymentName,
			namespace: doc.namespace,
			message: 'Deleted'
		});

		doc._req = req;
		await doc.remove();

		logger.info(`[${txnId}] Destroyed function data :: ${id}`);

		res.status(200).json({
			message: 'Function Deleted'
		});
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

module.exports = router;