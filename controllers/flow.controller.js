const _ = require('lodash');
const log4js = require('log4js');
const mongoose = require('mongoose');
const router = require('express').Router({ mergeParams: true });

const dataStackUtils = require('@appveen/data.stack-utils');

const config = require('../config');
const flowUtils = require('../utils/flow.utils');
const queryUtils = require('../utils/query.utils');
const deployUtils = require('../utils/deploy.utils');
const helpers = require('../utils/helper');

const logger = log4js.getLogger(global.loggerName);

const flowModel = mongoose.model('flow');
const draftFlowModel = mongoose.model('flow.draft');
const agentActionModel = mongoose.model('agent-action');

function mergeCustomizer(objValue, srcValue) {
	if (_.isArray(objValue)) {
		return srcValue;
	}
}


router.get('/', async (req, res) => {
	try {
		const filter = queryUtils.parseFilter(req.query.filter);
		if (filter) {
			filter.app = filter.app || req.locals.app;
		}
		if (req.query.countOnly) {
			const count = await flowModel.countDocuments(filter);
			return res.status(200).json(count);
		}
		const data = queryUtils.getPaginationData(req);
		const docs = await flowModel.find(filter).select(data.select).sort(data.sort).skip(data.skip).limit(data.count).lean();
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

		logger.info(`[${txnId}] Flow show request received :: ${id} :: draft :: ${draft}`);

		if (draft) {
			let draftQuery = draftFlowModel.findById(id);
			if (req.query.select) {
				draftQuery = draftQuery.select(req.query.select);
			}
			let draftDoc = await draftQuery.lean();
			if (draftDoc) {
				return res.status(200).json(draftDoc);
			}
			logger.debug(`[${txnId}] Flow draft not found in draft collection, checking in main collection`);
		}

		let mongoQuery = flowModel.findById(id);
		if (req.query.select) {
			mongoQuery = mongoQuery.select(req.query.select);
		}
		let doc = await mongoQuery.lean();
		if (!doc) {
			logger.error(`[${txnId}] Flow data not found`);
			return res.status(404).json({
				message: 'Flow Not Found'
			});
		}
		res.status(200).json(doc);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.post('/', async (req, res) => {
	try {
		let txnId = req.get('TxnId');
		let socket = req.app.get('socket');
		let payload = JSON.parse(JSON.stringify(req.body));

		logger.info(`[${txnId}] Flow create request received`);
		logger.trace(`[${txnId}] Flow details :: ${JSON.stringify(payload)}`);

		payload.app = payload.app || req.locals.app;
		const errorMsg = flowUtils.validatePayload(payload);
		if (errorMsg) {
			return res.status(400).json({ message: errorMsg });
		}
		delete payload.__v;
		delete payload.version;
		delete payload.draftVersion;
		delete payload.status;
		delete payload.port;
		delete payload.deploymentName;
		delete payload.namespace;

		payload.version = 1;

		logger.trace(`[${txnId}] Flow create data :: ${JSON.stringify(payload)}`);

		const doc = new flowModel(payload);
		doc._req = req;
		const status = await doc.save();

		if (doc.status != 'Draft' && doc.inputNode.type === 'FILE' || doc.nodes.some(node => node.type === 'FILE')) {
			let action = 'create';
			let flowActionList = helpers.constructFlowEvent(req, '', doc, action);
			flowActionList.forEach(action => {
				const actionDoc = new agentActionModel(action);
				actionDoc._req = req;
				let status = actionDoc.save();
				logger.trace(`[${txnId}] Flow Action Create Status - `, status);
				logger.trace(`[${txnId}] Flow Action Doc - `, actionDoc);
			});
		}

		socket.emit('flowCreated', {
			app: payload.app,
			url: payload.url,
			port: status.port,
			deploymentName: status.deploymentName,
			namespace: status.namespace,
			message: status.status
		});

		res.status(200).json(status);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.put('/:id', async (req, res) => {
	try {
		let txnId = req.get('TxnId');
		let id = req.params.id;
		let socket = req.app.get('socket');
		let payload = JSON.parse(JSON.stringify(req.body));

		logger.info(`[${txnId}] Flow update request received - ${id}`);
		logger.trace(`[${txnId}] Flow update data received :: ${JSON.stringify(payload)}`);


		payload.app = payload.app || req.locals.app;
		const errorMsg = flowUtils.validatePayload(payload);
		if (errorMsg) {
			return res.status(400).json({ message: errorMsg });
		}


		let doc = await flowModel.findById(id);

		if (!doc) {
			logger.error(`[${txnId}] Flow data not found in b2b.flow collection`);
			return res.status(404).json({
				message: 'Flow Not Found'
			});
		}

		logger.debug(`[${txnId}] Flow found in b2b.flow collection for ID :: ${id}`);
		logger.trace(`[${txnId}] Flow data found :: ${JSON.stringify(doc)}`);

		let flowData = JSON.parse(JSON.stringify(doc));


		delete payload._id;
		delete payload.__v;
		delete payload.version;
		delete payload.draftVersion;
		delete payload.status;
		delete payload.port;
		delete payload.deploymentName;
		delete payload.namespace;
		payload._id = id;


		let status;
		if (flowData.status === 'Draft') {

			_.merge(doc, payload, mergeCustomizer);
			if (payload.inputNode && !_.isEmpty(payload.inputNode)) {
				doc.inputNode = payload.inputNode;
			}
			if (payload.nodes && !_.isEmpty(payload.nodes)) {
				doc.nodes = payload.nodes;
			}

			logger.info(`[${txnId}] Flow is in draft status`);
			logger.trace(`[${txnId}] Flow data to be updated :: ${JSON.stringify(doc)}`);

			doc._req = req;
			doc.markModified('inputNode');
			doc.markModified('nodes');
			doc.markModified('dataStructures');

			status = await doc.save();

		} else if (flowData.draftVersion) {

			logger.info(`[${txnId}] Flow is not in draft status, but has a draft linked to it`);

			let draftData = await draftFlowModel.findOne({ _id: id, '_metadata.deleted': false });

			logger.trace(`[${txnId}] Linked flow draft data found :: ${JSON.stringify(draftData)}`);
			logger.trace(`[${txnId}] New flow draft data to be updated :: ${JSON.stringify(payload)}`);

			draftData = Object.assign(draftData, payload);

			draftData._req = req;
			
			status = await draftData.save();

		} else {

			logger.info(`[${txnId}] Flow is neither in draft status nor has a linked draft, creating a new draft`);

			let newData = new draftFlowModel(Object.assign({}, JSON.parse(JSON.stringify(doc)), payload));

			newData.version = flowData.version + 1;
			newData.status = 'Draft';
			doc.draftVersion = newData.version;

			logger.trace(`[${txnId}] Flow data to be updated :: ${JSON.stringify(doc)}`);
			logger.trace(`[${txnId}] New draft flow data to be created :: ${JSON.stringify(newData)}`);

			newData._req = req;
			doc._req = req;

			status = await newData.save();
			await doc.save();
		}

		if (doc.status != 'Draft' && doc.inputNode.type === 'FILE' || doc.nodes.some(node => node.type === 'FILE')) {
			let action = 'update';
			let flowActionList = helpers.constructFlowEvent(req, '', doc, action);
			flowActionList.forEach(action => {
				const actionDoc = new agentActionModel(action);
				actionDoc._req = req;
				let status = actionDoc.save();
				logger.trace(`[${txnId}] Flow Action Update Status - `, status);
				logger.trace(`[${txnId}] Flow Action Doc - `, actionDoc);
			});
		}

		res.status(200).json(status);

		socket.emit('flowStatus', {
			_id: id,
			app: flowData.app,
			url: flowData.url,
			port: flowData.port,
			deploymentName: flowData.deploymentName,
			namespace: flowData.namespace,
			message: 'Updated'
		});
	} catch (err) {
		logger.error(err);
		if (err.message.includes('FLOW_NAME_ERROR')) {
			res.status(400).json({
				message: err.message
			});
		} else {
			res.status(500).json({
				message: err.message
			});
		}
	}
});

router.delete('/:id', async (req, res) => {
	try {
		let id = req.params.id;
		let txnId = req.get('TxnId');
		let socket = req.app.get('socket');
		logger.info(`[${txnId}] Flow destroy request received :: ${id}`);

		let doc = await flowModel.findById(id);
		if (!doc) {
			logger.error(`[${txnId}] Flow data not found for id :: ${id}`);
			return res.status(404).json({
				message: 'Flow Not Found'
			});
		}

		logger.info(`[${txnId}] Flow data found for id :: ${id}`);
		logger.trace(`[${txnId}] Flow data found :: ${JSON.stringify(doc)}`);


		if (doc.status != 'Stopped' && doc.status != 'Draft') {
			logger.error(`[${txnId}] Flow is in Active state.`);
			return res.status(400).json({
				message: 'Running flows cannot be deleted'
			});
		}

		let draftData = await draftFlowModel.findOne({ _id: id, '_metadata.deleted': false });
		if (!draftData) {
			logger.info(`[${txnId}] Draft data not available for flow :: ${id}`);
		} else {
			draftData._req = req;
			await draftData.remove();
		}


		if (config.isK8sEnv() && doc.status == 'Active') {
			const status = await deployUtils.undeploy(doc);
			if (status.statusCode !== 200 && status.statusCode !== 202) {
				return res.status(status.statusCode).json({ message: 'Unable to stop Flow' });
			}
		}


		let eventId = 'EVENT_FLOW_DELETE';
		logger.debug(`[${txnId}] Publishing Event :: ${eventId}`);
		dataStackUtils.eventsUtil.publishEvent(eventId, 'flow', req, doc, null);

		if (doc.status != 'Draft' && doc.inputNode.type === 'FILE' || doc.nodes.some(node => node.type === 'FILE')) {
			let action = 'delete';
			let flowActionList = helpers.constructFlowEvent(req, '', doc, action);
			flowActionList.forEach(action => {
				const actionDoc = new agentActionModel(action);
				actionDoc._req = req;
				let status = actionDoc.save();
				logger.trace(`[${txnId}] Flow Action Delete Status - `, status);
				logger.trace(`[${txnId}] Flow Action Doc - `, actionDoc);
			});
		}

		socket.emit('flowDeleted', {
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

		logger.info(`[${txnId}] Destroyed flow data :: ${id}`);

		res.status(200).json({
			message: 'Data Pipe Deleted'
		});
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

module.exports = router;