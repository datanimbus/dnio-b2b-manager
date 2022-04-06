const router = require('express').Router();
const log4js = require('log4js');
const mongoose = require('mongoose');

// const codeGen = require('../code-gen/faas');
// const deployUtils = require('../utils/deploy.utils');
const queryUtils = require('../utils/query.utils');
const k8sUtils = require('../utils/k8s.utils');
const config = require('../config');

const logger = log4js.getLogger('faas.controller');
const faasModel = mongoose.model('faas');
const faasDraftModel = mongoose.model('faas.draft');

let dockerRegistryType = process.env.DOCKER_REGISTRY_TYPE ? process.env.DOCKER_REGISTRY_TYPE : '';
if (dockerRegistryType.length > 0) dockerRegistryType = dockerRegistryType.toUpperCase();

let dockerReg = process.env.DOCKER_REGISTRY_SERVER ? process.env.DOCKER_REGISTRY_SERVER : '';
if (dockerReg.length > 0 && !dockerReg.endsWith('/') && dockerRegistryType != 'ECR') dockerReg += '/';
let flowBaseImage = `${dockerReg}data.stack.b2b.base:${config.imageTag}`;
if (dockerRegistryType == 'ECR') flowBaseImage = `${dockerReg}:data.stack.b2b.base:${config.imageTag}`;

router.get('/count', async (req, res) => {
	try {
		const filter = queryUtils.parseFilter(req.query.filter);
		if (filter) {
			filter.app = req.locals.app;
		}
		const count = await faasModel.countDocuments(filter);
		return res.status(200).json(count);
	} catch (err) {
		logger.error(err);
		if (typeof err === 'string') {
			return res.status(500).json({
				message: err
			});
		}
		res.status(500).json({
			message: err.message
		});
	}
});

router.put('/:id/init', async (req, res) => {
	try {
		const doc = await faasModel.findById(req.params.id);
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Function' });
		}
		doc.status = 'Active';
		doc._req = req;
		await doc.save();
		res.status(200).json({ message: 'Function Status Updated' });
	} catch (err) {
		logger.error(err);
		if (typeof err === 'string') {
			return res.status(500).json({
				message: err
			});
		}
		res.status(500).json({
			message: err.message
		});
	}
});


router.put('/:id/deploy', async (req, res) => {
	try {
		let id = req.params.id;
		let txnId = req.header('txnId');
		let socket = req.app.get('socket');

		logger.info(`[${txnId}] Faas deployment request received :: ${id}`);

		let user = req.user;
		let isSuperAdmin = user.isSuperAdmin;
		let verifyDeploymentUser = config.verifyDeploymentUser;

		logger.debug(`[${txnId}] User details - ${JSON.stringify({ user, isSuperAdmin, verifyDeploymentUser })}`);

		let doc = await faasModel.findOne({ _id: id, '_metadata.deleted': false });
		if (!doc) {
			logger.error(`[${txnId}] Faas data not found for id :: ${id}`);
			return res.status(400).json({ message: 'Invalid Function' });
		}
		const oldFaasObj = doc.toObject();
		logger.debug(`[${txnId}] Faas data found`);
		logger.trace(`[${txnId}] Faas data found :: ${JSON.stringify(doc)}`);

		if (doc.status === 'Active' && !doc.draftVersion) {
			logger.error(`[${txnId}] Faas is already running, cannot deploy again`);
			return res.status(400).json({ message: 'No changes to redeploy' });
		} else if (doc.status != 'Draft' && !doc.draftVersion) {
			logger.error(`[${txnId}] Faas has no draft version for deployment`);
			return res.status(400).json({ message: 'No changes to redeploy' });
		} else if (doc.status === 'Draft') {
			logger.debug(`[${txnId}] Faas is in Draft status`);
			if (verifyDeploymentUser && !isSuperAdmin && doc._metadata && doc._metadata.lastUpdatedBy == user) {
				logger.error(`[${txnId}] Self deployment not allowed ::  ${{ lastUpdatedBy: doc._metadata.lastUpdatedBy, currentUser: user }}`);
				return res.status(403).json({ message: 'You cannot deploy your own changes' });
			}
		} else {
			logger.debug(`[${txnId}] Faas is not in draft status, checking in draft collection :: ${doc.status}`);

			const draftDoc = await faasDraftModel.findOne({ _id: id, '_metadata.deleted': false });

			if (!draftDoc) {
				logger.error(`[${txnId}] Faas has no draft version for deployment`);
				return res.status(400).json({ message: 'No changes to redeploy' });
			}
			logger.debug(`[${txnId}] Faas data found in draft collection`);
			logger.trace(`[${txnId}] Faas draft data :: ${JSON.stringify(draftDoc)}`);

			if (verifyDeploymentUser && !isSuperAdmin && draftDoc._metadata && draftDoc._metadata.lastUpdatedBy == user) {
				logger.error(`[${txnId}] Self deployment not allowed :: ${{ lastUpdatedBy: draftDoc._metadata.lastUpdatedBy, currentUser: user }}`);
				return res.status(400).json({ message: 'You cannot deploy your own changes' });
			}

			if (draftDoc && draftDoc.app != doc.app) {
				logger.error(`[${txnId}] App change not permitted`);
				return res.status(400).json({ message: 'App change not permitted' });
			}
			const newFaasObj = draftDoc.toObject();
			delete newFaasObj.__v;
			delete newFaasObj._metadata;
			Object.assign(doc, newFaasObj);
			draftDoc._req = req;
			await draftDoc.remove();
		}
		doc.draftVersion = null;
		doc.status = 'Pending';
		doc._req = req;
		doc._oldData = oldFaasObj;
		await doc.save();
		socket.emit('faasStatus', {
			_id: id,
			app: doc.app,
			message: 'Deployed'
		});
		// await codeGen.createProject(doc, txnId);
		// const status = await deployUtils.deploy(doc, 'faas');
		doc.image = flowBaseImage;
		const status = await k8sUtils.upsertDeployment(doc);
		if (status.statusCode !== 200 || status.statusCode !== 202) {
			return res.status(status.statusCode).json({ message: 'Unable to deploy function' });
		}
		res.status(200).json({ message: 'Function Deployed' });

	} catch (err) {
		logger.error(err);
		if (typeof err === 'string') {
			return res.status(500).json({
				message: err
			});
		}
		res.status(500).json({
			message: err.message
		});
	}
});

router.put('/:id/repair', async (req, res) => {
	try {
		const doc = await faasModel.findById(req.params.id).lean();
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Function' });
		}
		// await codeGen.createProject(doc, req.header('txnId'));
		// const status = await deployUtils.repair(doc, 'faas');
		doc.image = flowBaseImage;
		let status = await k8sUtils.deleteDeployment(doc);
		status = await k8sUtils.upsertDeployment(doc);
		if (status.statusCode !== 200 || status.statusCode !== 202) {
			return res.status(status.statusCode).json({ message: 'Unable to repair function' });
		}
		res.status(200).json({ message: 'Function Repaired' });
	} catch (err) {
		logger.error(err);
		if (typeof err === 'string') {
			return res.status(500).json({
				message: err
			});
		}
		res.status(500).json({
			message: err.message
		});
	}
});

router.put('/:id/start', async (req, res) => {
	try {
		let id = req.params.id;
		let txnId = req.get('TxnId');
		let socket = req.app.get('socket');
		logger.info(`[${txnId}] Function start request received :: ${id}`);

		const doc = await faasModel.findById(req.params.id).lean();
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Function' });
		}

		logger.debug(`[${txnId}] Function data found for id :: ${id}`);
		logger.trace(`[${txnId}] Function data :: ${JSON.stringify(doc)}`);

		if (doc.status === 'Active') {
			logger.error(`[${txnId}] Function is already running, cant start again`);
			return res.status(400).json({ message: 'Can\'t restart running function' });
		}

		doc.status = 'Pending';
		doc._req = req;
		await doc.save();

		let eventId = 'EVENT_FAAS_START';
		logger.debug(`[${txnId}] Publishing Event :: ${eventId}`);
		dataStackUtils.eventsUtil.publishEvent(eventId, 'faas', req, doc, null);

		socket.emit('faasStatus', {
			_id: id,
			app: doc.app,
			message: 'Started'
		});

		logger.info(`[${txnId}] Scaling up deployment :: ${doc.deploymentName}`);

		// const status = await deployUtils.start(doc);
		const status = await k8sUtils.scaleDeployment(doc, 1);

		if (status.statusCode !== 200 || status.statusCode !== 202) {
			return res.status(status.statusCode).json({ message: 'Unable to start function' });
		}

		res.status(200).json({ message: 'Function Started' });
	} catch (err) {
		logger.error(err);
		if (typeof err === 'string') {
			return res.status(500).json({
				message: err
			});
		}
		res.status(500).json({
			message: err.message
		});
	}
});

router.put('/:id/stop', async (req, res) => {
	try {
		let id = req.params.id;
		let txnId = req.get('TxnId');
		let socket = req.app.get('socket');
		logger.info(`[${txnId}] Function stop request received :: ${id}`);

		const doc = await faasModel.findById(req.params.id);
		if (!doc) {
			return res.status(404).json({ message: 'Invalid Function' });
		}

		logger.debug(`[${txnId}] Function data found for id :: ${id}`);
		logger.trace(`[${txnId}] Function data :: ${JSON.stringify(doc)}`);

		if (doc.status !== 'Active') {
			logger.debug(`[${txnId}] Function is not running, can't stop again`);
			return res.status(400).json({ message: 'Can\'t stop inactive function' });
		}

		logger.info(`[${txnId}] Scaling down deployment :: ${JSON.stringify({ namespace: doc.namespace, deploymentName: doc.deploymentName })}`);
	
		// const status = await deployUtils.stop(doc);
		const status = await k8sUtils.scaleDeployment(doc, 0);

		if (status.statusCode !== 200 || status.statusCode !== 202) {
			return res.status(status.statusCode).json({ message: 'Unable to stop Function' });
		}

		logger.debug(`[${txnId}] Deployment Scaled :: ${JSON.stringify(status)}`);

		let eventId = 'EVENT_FAAS_STOP';
		logger.debug(`[${txnId}] Publishing Event - ${eventId}`);
		dataStackUtils.eventsUtil.publishEvent(eventId, 'faas', req, doc, null);

		socket.emit('faasStatus', {
			_id: id,
			app: doc.app,
			message: 'Stopped'
		});

		doc.status = 'Stopped';
		doc._req = req;
		await doc.save();
		res.status(200).json({ message: 'Function Stopped' });
	} catch (err) {
		logger.error(err);
		if (typeof err === 'string') {
			return res.status(500).json({
				message: err
			});
		}
		res.status(500).json({
			message: err.message
		});
	}
});

router.put('/:id/draftDelete', async (req, res) => {
	try {
		let id = req.params.id;
		let txnId = req.get('TxnId');
		logger.info(`[${txnId}] Function draft delete request received :: ${id}`);

		let doc = await faasModel.findById(id);
		if (!doc) {
			logger.error(`[${txnId}] Function data not found for id :: ${id}`);
			return res.status(404).json({ message: 'Invalid Function' });
		}

		let draftDoc = await faasDraftModel.findById(id);
		if (!draftDoc) {
			logger.debug(`[${txnId}] Function draft data not found for id :: ${id}`);
		}

		logger.debug(`[${txnId}] Function draft data found for id :: ${id}`);
		logger.trace(`[${txnId}] Function draft data :: ${JSON.stringify(draftData)}`);
		draftDoc._req = req;
		await draftData.remove();

		logger.debug(`[${txnId}] Function data found for id :: ${id}`);
		logger.trace(`[${txnId}] Function data :: ${JSON.stringify(doc)}`);

		doc.draftVersion = null;
		doc._req = req;
		await doc.remove();

		dataStackUtils.eventsUtil.publishEvent('EVENT_FAAS_DISCARD_DRAFT', 'faas', req, doc);

		res.status(200).json({ message: 'Draft deleted for ' + id });
	} catch (err) {
		logger.error(err);
		if (typeof err === 'string') {
			return res.status(500).json({
				message: err
			});
		}
		res.status(500).json({
			message: err.message
		});
	}
});

router.put('/:id/statusChange', async (req, res) => {
	let id = req.params.id;
	let status = req.query.status;
	let socket = req.app.get('socket');

	logger.info(`[${req.get('TxnId')}] Faas status update params - ${JSON.stringify({ id, status })}`);
	try {
		const doc = await faasModel.findById(id);
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Function' });
		}
		doc.status = status;
		if (doc._metadata && doc._metadata.lastUpdated) doc._metadata.lastUpdated = new Date();
		doc._req = req;
		await doc.save();
		logger.debug(`[${req.get('TxnId')}] Emitting socket event - ${JSON.stringify({ _id: id, app: doc.app, message: status })}`);
		socket.emit('faasStatus', {
			_id: id,
			app: doc.app,
			message: status
		});

		res.status(200).json({ message: 'Status Updated' });
	} catch (err) {
		logger.error(err);
		if (typeof err === 'string') {
			return res.status(500).json({
				message: err
			});
		}
		res.status(500).json({
			message: err.message
		});
	}
});

module.exports = router;