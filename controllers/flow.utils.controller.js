const log4js = require('log4js');
const mongoose = require('mongoose');
const yamljs = require('json-to-pretty-yaml');
const router = require('express').Router({ mergeParams: true });
const dataStackUtils = require('@appveen/data.stack-utils');
const _ = require('lodash');

const config = require('../config');
const k8sUtils = require('../utils/k8s.utils');
const queryUtils = require('../utils/query.utils');
const routerUtils = require('../utils/router.utils');
const helpers = require('../utils/helper');
const commonUtils = require('../utils/common.utils');

const logger = log4js.getLogger(global.loggerName);

const flowModel = mongoose.model('flow');
const draftFlowModel = mongoose.model('flow.draft');
const agentActionModel = mongoose.model('agent-action');
const flowConfigModel = mongoose.model('b2b.libraries');

let dockerRegistryType = process.env.DOCKER_REGISTRY_TYPE ? process.env.DOCKER_REGISTRY_TYPE : '';
if (dockerRegistryType.length > 0) dockerRegistryType = dockerRegistryType.toUpperCase();

let dockerReg = process.env.DOCKER_REGISTRY_SERVER ? process.env.DOCKER_REGISTRY_SERVER : '';
if (dockerReg.length > 0 && !dockerReg.endsWith('/') && dockerRegistryType != 'ECR') dockerReg += '/';

// let flowBaseImage = `${dockerReg}datanimbus.io.b2b.base:${config.imageTag}`;
// if (dockerRegistryType == 'ECR') flowBaseImage = `${dockerReg}:datanimbus.io.b2b.base:${config.imageTag}`;


router.get('/count', async (req, res) => {
	try {
		const filter = queryUtils.parseFilter(req.query.filter);
		if (filter) {
			filter.app = req.locals.app;
		}
		const count = await flowModel.countDocuments(filter);
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

router.get('/status/count', async (req, res) => {
	try {
		let filter = queryUtils.parseFilter(req.query.filter);
		if (filter) {
			filter.app = req.locals.app;
			filter['_metadata.deleted'] = false;
		}

		let aggregateQuery = [
			{ $match: filter },
			{
				$group: {
					_id: '$status',
					count: { $sum: 1 }
				}
			}
		];
		let result = await flowModel.aggregate(aggregateQuery);

		let response = {};
		let total = 0;
		result.forEach(rs => {
			response[rs._id] = rs.count;
			total += rs.count;
		});
		response['Total'] = total;

		return res.json(response);
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

router.get('/node-library/count', async (req, res) => {
	try {
		const filter = queryUtils.parseFilter(req.query.filter);
		if (filter) {
			delete filter.app;
		}
		const docs = await flowConfigModel.countDocuments(filter);
		res.status(200).json(docs);
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

router.get('/node-library', async (req, res) => {
	try {
		const filter = queryUtils.parseFilter(req.query.filter);
		if (filter) {
			delete filter.app;
		}
		const data = queryUtils.getPaginationData(req);
		const docs = await flowConfigModel.find(filter).select(data.select).sort(data.sort).skip(data.skip).limit(data.count).lean();
		res.status(200).json(docs);
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

router.post('/node-library', async (req, res) => {
	try {
		const doc = new flowConfigModel(req.body);
		doc._req = req;
		const status = await doc.save();
		res.status(200).json(status);
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

router.put('/node-library/:id', async (req, res) => {
	try {
		let doc = await flowConfigModel.findById(req.params.id);
		doc._req = req;
		doc = _.merge(doc, req.body);
		const status = await doc.save();
		res.status(200).json(status);
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

router.delete('/node-library/:id', async (req, res) => {
	try {
		const status = await flowConfigModel.deleteOne({ _id: req.params.id });
		logger.info('Library Deleted!');
		logger.debug(status);
		res.status(200).json({ message: 'Library deleted successfully' });
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
		const doc = await flowModel.findById(req.params.id);
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Flow' });
		}
		doc.status = 'Active';
		doc.isNew = false;
		doc._req = req;
		await doc.save();
		res.status(200).json({ message: 'Flow Status Updated' });
		routerUtils.initRouterMap();
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

		logger.info(`[${txnId}] Flow deployment request received :: ${id}`);


		let user = req.user;
		let isSuperAdmin = user.isSuperAdmin;
		let verifyDeploymentUser = config.verifyDeploymentUser;

		logger.debug(`[${txnId}] User details - ${JSON.stringify({ user, isSuperAdmin, verifyDeploymentUser })}`);

		const doc = await flowModel.findById(id);
		if (!doc) {
			logger.error(`[${txnId}] Flow data not found for id :: ${id}`);
			return res.status(400).json({ message: 'Invalid Flow' });
		}
		const appData = await commonUtils.getApp(req, doc.app);
		if (!appData.body.b2bBaseImage) {
			return res.status(400).json({ message: 'Base Image not Set' });
		}
		let flowBaseImage = appData.body.b2bBaseImage;

		const oldFlowObj = JSON.parse(JSON.stringify(doc));
		logger.debug(`[${txnId}] Flow data found`);
		logger.trace(`[${txnId}] Flow data found :: ${JSON.stringify(doc)}`);


		if (doc.status === 'Active' && !doc.draftVersion) {
			logger.error(`[${txnId}] Flow is already running, cannot deploy again`);
			return res.status(400).json({ message: 'No changes to redeploy' });
		} else if (doc.status != 'Draft' && !doc.draftVersion) {
			logger.error(`[${txnId}] Flow has no draft version for deployment`);
			return res.status(400).json({ message: 'No changes to redeploy' });
		} else if (doc.status === 'Draft') {
			logger.debug(`[${txnId}] Flow is in Draft status`);
			if (verifyDeploymentUser && !isSuperAdmin && doc._metadata && doc._metadata.lastUpdatedBy == user) {
				logger.error(`[${txnId}] Self deployment not allowed ::  ${{ lastUpdatedBy: doc._metadata.lastUpdatedBy, currentUser: user }}`);
				return res.status(403).json({ message: 'You cannot deploy your own changes' });
			}
		} else {
			logger.debug(`[${txnId}] Flow is not in draft status, checking in draft collection :: ${doc.status}`);

			const draftDoc = await draftFlowModel.findOne({ _id: id, '_metadata.deleted': false });

			if (!draftDoc) {
				logger.error(`[${txnId}] Flow has no draft version for deployment`);
				return res.status(400).json({ message: 'No changes to redeploy' });
			}
			logger.debug(`[${txnId}] Flow data found in draft collection`);
			logger.trace(`[${txnId}] Flow draft data :: ${JSON.stringify(draftDoc)}`);

			if (verifyDeploymentUser && !isSuperAdmin && draftDoc._metadata && draftDoc._metadata.lastUpdatedBy == user) {
				logger.error(`[${txnId}] Self deployment not allowed :: ${{ lastUpdatedBy: draftDoc._metadata.lastUpdatedBy, currentUser: user }}`);
				return res.status(400).json({ message: 'You cannot deploy your own changes' });
			}

			if (draftDoc && draftDoc.app != doc.app) {
				logger.error(`[${txnId}] App change not permitted`);
				return res.status(400).json({ message: 'App change not permitted' });
			}

			const newFlowObj = draftDoc.toObject();
			delete newFlowObj.__v;
			delete newFlowObj._metadata;
			delete newFlowObj.version;
			Object.assign(doc, newFlowObj);
			draftDoc._req = req;
			await draftDoc.remove();
		}

		doc.version = oldFlowObj.draftVersion;
		doc.draftVersion = null;
		doc.status = 'Pending';
		doc._req = req;
		doc._oldData = oldFlowObj;


		if (config.isK8sEnv() && !doc.isBinary) {
			doc.image = flowBaseImage;

			doc.status = 'Pending';
			doc.isNew = false;

			await doc.save();

			let status = await k8sUtils.upsertService(doc);
			status = await k8sUtils.upsertDeployment(doc);

			logger.info('Deploy API called');
			logger.debug(status);

			if (status.statusCode != 200 && status.statusCode != 202) {
				return res.status(status.statusCode).json({ message: 'Unable to deploy Flow' });
			}


		} else if (doc.isBinary) {
			doc.status = 'Active';
			doc.isNew = false;

			await doc.save();

		} else {
			doc.status = 'Pending';
			doc.isNew = false;

			await doc.save();
		}

		if (doc.inputNode.type === 'FILE' || doc.nodes.some(node => node.type === 'FILE')) {
			let action;
			if (oldFlowObj.status === 'Active') {
				action = 'update';
			} else {
				action = 'create';
			}

			let flowActionList = helpers.constructFlowEvent(req, '', doc, action);
			flowActionList.forEach(action => {
				const actionDoc = new agentActionModel(action);
				actionDoc._req = req;
				let status = actionDoc.save();
				logger.trace(`[${txnId}] Flow Action Create Status - `, status);
				logger.trace(`[${txnId}] Flow Action Doc - `, actionDoc);
			});
		}

		socket.emit('flowStatus', {
			_id: id,
			app: doc.app,
			url: doc.url,
			port: doc.port,
			deploymentName: doc.deploymentName,
			namespace: doc.namespace,
			message: 'Deployed'
		});

		res.status(200).json({ message: 'Flow Deployed' });
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
		logger.info('Flow repair API called');

		const doc = await flowModel.findById(req.params.id).lean();
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Flow' });
		}
		const appData = await commonUtils.getApp(req, doc.app);
		if (!appData.body.b2bBaseImage) {
			return res.status(400).json({ message: 'Base Image not Set' });
		}
		let flowBaseImage = appData.body.b2bBaseImage;

		if (config.isK8sEnv()) {
			doc.image = flowBaseImage;
			let status = await k8sUtils.deleteDeployment(doc);
			status = await k8sUtils.deleteService(doc);
			status = await k8sUtils.upsertService(doc);
			status = await k8sUtils.upsertDeployment(doc);

			logger.debug(status);

			if (status.statusCode !== 200 && status.statusCode !== 202) {
				return res.status(status.statusCode).json({ message: 'Unable to repair Flow' });
			}
		}

		doc.status = 'Pending';
		doc.isNew = false;
		doc._req = req;

		await doc.save();

		res.status(200).json({ message: 'Flow Repaired' });
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
		logger.info(`[${txnId}] Flow start request received :: ${id}`);

		const doc = await flowModel.findById(req.params.id);
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Flow' });
		}

		logger.debug(`[${txnId}] Flow data found for id :: ${id}`);
		logger.trace(`[${txnId}] Flow data :: ${JSON.stringify(doc)}`);


		if (doc.status === 'Active') {
			logger.error(`[${txnId}] Flow is already running, cant start again`);
			return res.status(400).json({ message: 'Can\'t restart a running flow' });
		}


		logger.info(`[${txnId}] Scaling up deployment :: ${doc.deploymentName}`);

		if (config.isK8sEnv() && !doc.isBinary) {
			const status = await k8sUtils.scaleDeployment(doc, 1);

			logger.trace(`[${txnId}] Deployment Scaled status :: ${JSON.stringify(status)}`);

			if (status.statusCode !== 200 && status.statusCode !== 202) {
				return res.status(status.statusCode).json({ message: 'Unable to start Flow' });
			}
		}

		doc.status = 'Pending';
		doc.isNew = false;
		doc._req = req;
		await doc.save();

		let eventId = 'EVENT_FLOW_START';
		logger.debug(`[${txnId}] Publishing Event :: ${eventId}`);
		dataStackUtils.eventsUtil.publishEvent(eventId, 'flow', req, doc, null);

		if (doc.inputNode.type === 'FILE' || doc.nodes.some(node => node.type === 'FILE')) {
			let action = 'start';
			let flowActionList = helpers.constructFlowEvent(req, '', doc, action);
			flowActionList.forEach(action => {
				const actionDoc = new agentActionModel(action);
				actionDoc._req = req;
				let status = actionDoc.save();
				logger.trace(`[${txnId}] Flow Action Create Status - `, status);
				logger.trace(`[${txnId}] Flow Action Doc - `, actionDoc);
			});
		}

		socket.emit('flowStatus', {
			_id: id,
			app: doc.app,
			url: doc.url,
			port: doc.port,
			deploymentName: doc.deploymentName,
			namespace: doc.namespace,
			message: 'Started'
		});

		res.status(200).json({ message: 'Flow Started' });
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
		logger.info(`[${txnId}] Flow stop request received :: ${id}`);

		const doc = await flowModel.findById(id);
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Flow' });
		}

		logger.debug(`[${txnId}] Flow data found for id :: ${id}`);
		logger.trace(`[${txnId}] Flow data :: ${JSON.stringify(doc)}`);

		if (doc.status !== 'Active') {
			logger.debug(`[${txnId}] Flow is not running, can't stop again`);
			return res.status(400).json({ message: 'Can\'t stop an inactive flow' });
		}

		logger.info(`[${txnId}] Scaling down deployment :: ${JSON.stringify({ namespace: doc.namespace, deploymentName: doc.deploymentName })}`);

		if (config.isK8sEnv() && !doc.isBinary) {
			const status = await k8sUtils.scaleDeployment(doc, 0);
			logger.info('Stop API called');
			logger.debug(status);
			if (status.statusCode !== 200 && status.statusCode !== 202) {
				logger.error('K8S :: Error stopping flow');
				return res.status(status.statusCode).json({ message: 'Unable to stop Flow' });
			}
		}

		let eventId = 'EVENT_FLOW_STOP';
		logger.debug(`[${txnId}] Publishing Event - ${eventId}`);
		dataStackUtils.eventsUtil.publishEvent(eventId, 'flow', req, doc, null);

		if (doc.inputNode.type === 'FILE' || doc.nodes.some(node => node.type === 'FILE')) {
			let action = 'stop';
			let flowActionList = helpers.constructFlowEvent(req, '', doc, action);
			flowActionList.forEach(action => {
				const actionDoc = new agentActionModel(action);
				actionDoc._req = req;
				let status = actionDoc.save();
				logger.trace(`[${txnId}] Flow Action Create Status - `, status);
				logger.trace(`[${txnId}] Flow Action Doc - `, actionDoc);
			});
		}

		socket.emit('flowStatus', {
			_id: id,
			app: doc.app,
			url: doc.url,
			port: doc.port,
			deploymentName: doc.deploymentName,
			namespace: doc.namespace,
			message: 'Stopped'
		});

		doc.status = 'Stopped';
		doc.isNew = false;
		doc._req = req;
		await doc.save();

		res.status(200).json({ message: 'Flow Stopped' });
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

router.put('/startAll', async (req, res) => {
	try {
		let app = req.params.app;
		let txnId = req.get('TxnId');
		let socket = req.app.get('socket');
		logger.info(`[${txnId}] Start all flows request received for app :: ${app}`);

		const docs = await flowModel.find({ 'app': app, 'status': 'Stopped' });
		if (!docs) {
			return res.status(200).json({ message: 'No Flows to Start' });
		}

		logger.debug(`[${txnId}] Flows found for app :: ${app} :: ${docs.length}`);
		logger.trace(`[${txnId}] Flows data :: ${JSON.stringify(docs)}`);

		let promises = docs.map(async doc => {
			logger.info(`[${txnId}] Scaling up deployment :: ${doc.deploymentName}`);

			if (config.isK8sEnv() && !doc.isBinary) {
				const status = await k8sUtils.scaleDeployment(doc, 1);

				logger.trace(`[${txnId}] Deployment Scaled status :: ${JSON.stringify(status)}`);

				if (status.statusCode !== 200 && status.statusCode !== 202) {
					logger.error(`Unable to start Flow :: ${doc._id} :: ${JSON.stringify(status)}`);
					return;
				}
			}

			doc.status = 'Pending';
			doc.isNew = false;
			doc._req = req;
			await doc.save();

			let eventId = 'EVENT_FLOW_START';
			logger.debug(`[${txnId}] Publishing Event :: ${eventId}`);
			dataStackUtils.eventsUtil.publishEvent(eventId, 'flow', req, doc, null);

			socket.emit('flowStatus', {
				_id: doc._id,
				app: app,
				url: doc.url,
				port: doc.port,
				deploymentName: doc.deploymentName,
				namespace: doc.namespace,
				message: 'Started'
			});
		});

		res.status(202).json({
			message: 'Request to start all flows has been received'
		});
		return Promise.all(promises);

	} catch (err) {
		logger.error(err);
		if (!res.headersSent) {
			if (typeof err === 'string') {
				return res.status(500).json({
					message: err
				});
			}
			res.status(500).json({
				message: err.message
			});
		}
	}
});

router.put('/stopAll', async (req, res) => {
	try {
		let app = req.params.app;
		let txnId = req.get('TxnId');
		let socket = req.app.get('socket');
		logger.info(`[${txnId}] Stop all flows request received for app :: ${app}`);

		const docs = await flowModel.find({ 'app': app, 'status': 'Active' });
		if (!docs) {
			return res.status(200).json({ message: 'No Flows to Stop' });
		}

		logger.debug(`[${txnId}] Flows found for app :: ${app} :: ${docs.length}`);
		logger.trace(`[${txnId}] Flows data :: ${JSON.stringify(docs)}`);

		let promises = docs.map(async doc => {
			logger.info(`[${txnId}] Scaling down deployment :: ${JSON.stringify({ namespace: doc.namespace, deploymentName: doc.deploymentName })}`);

			if (config.isK8sEnv() && !doc.isBinary) {
				const status = await k8sUtils.scaleDeployment(doc, 0);

				logger.debug(status);

				if (status.statusCode !== 200 && status.statusCode !== 202) {
					logger.error('K8S :: Error stopping flow');
					logger.error(`Unable to stop Flow :: ${doc._id} :: ${status}`);
				}
			}

			let eventId = 'EVENT_FLOW_STOP';
			logger.debug(`[${txnId}] Publishing Event - ${eventId}`);
			dataStackUtils.eventsUtil.publishEvent(eventId, 'flow', req, doc, null);

			socket.emit('flowStatus', {
				_id: doc._id,
				app: app,
				url: doc.url,
				port: doc.port,
				deploymentName: doc.deploymentName,
				namespace: doc.namespace,
				message: 'Stopped'
			});

			doc.status = 'Stopped';
			doc.isNew = false;
			doc._req = req;
			await doc.save();
		});

		res.status(202).json({
			message: 'Request to stop all flows has been received'
		});
		return Promise.all(promises);

	} catch (err) {
		logger.error(err);
		if (!res.headersSent) {
			if (typeof err === 'string') {
				return res.status(500).json({
					message: err
				});
			}
			res.status(500).json({
				message: err.message
			});
		}
	}
});

router.put('/:id/draftDelete', async (req, res) => {
	try {
		let id = req.params.id;
		let txnId = req.get('TxnId');
		logger.info(`[${txnId}] Flow draft delete request received :: ${id}`);

		let doc = await flowModel.findById(id);
		if (!doc) {
			logger.error(`[${txnId}] Flow data not found for id :: ${id}`);
			return res.status(404).json({ message: 'Invalid Flow' });
		}

		let draftDoc = await draftFlowModel.findById(id);
		if (!draftDoc) {
			logger.debug(`[${txnId}] Flow draft data not found for id :: ${id}`);
			return res.status(404).json({ message: 'Draft not found for ' + id });
		}

		logger.debug(`[${txnId}] Flow draft data found for id :: ${id}`);
		logger.trace(`[${txnId}] Flow draft data :: ${JSON.stringify(draftDoc)}`);

		draftDoc._req = req;
		await draftDoc.remove();

		logger.debug(`[${txnId}] Flow data found for id :: ${id}`);
		logger.trace(`[${txnId}] Flow data :: ${JSON.stringify(doc)}`);

		doc.draftVersion = null;
		doc._req = req;
		await doc.save();

		dataStackUtils.eventsUtil.publishEvent('EVENT_FLOW_DISCARD_DRAFT', 'flow', req, doc);

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

router.get('/:id/yamls', async (req, res) => {
	try {
		const doc = await flowModel.findById(req.params.id);
		const appData = await commonUtils.getApp(req, doc.app);
		if (!appData.body.b2bBaseImage) {
			return res.status(400).json({ message: 'Base Image not Set' });
		}
		let flowBaseImage = appData.body.b2bBaseImage;
		const namespace = (config.DATA_STACK_NAMESPACE + '-' + doc.app).toLowerCase();
		const port = 8080;
		const name = doc.deploymentName;
		const envKeys = ['FQDN', 'LOG_LEVEL', 'MONGO_APPCENTER_URL', 'MONGO_AUTHOR_DBNAME', 'MONGO_AUTHOR_URL', 'MONGO_LOGS_DBNAME', 'MONGO_LOGS_URL', 'MONGO_RECONN_TIME', 'MONGO_RECONN_TRIES', 'STREAMING_CHANNEL', 'STREAMING_HOST', 'STREAMING_PASS', 'STREAMING_RECONN_ATTEMPTS', 'STREAMING_RECONN_TIMEWAIT', 'STREAMING_USER', 'DATA_STACK_NAMESPACE', 'CACHE_CLUSTER', 'CACHE_HOST', 'CACHE_PORT', 'CACHE_RECONN_ATTEMPTS', 'CACHE_RECONN_TIMEWAIT_MILLI', 'RELEASE', 'TLS_REJECT_UNAUTHORIZED', 'API_REQUEST_TIMEOUT', 'B2B_ALLOW_NPM_INSTALL'];
		const envVars = [];
		envKeys.forEach(key => {
			envVars.push({ name: key, value: process.env[key] });
		});
		envVars.push({ name: 'DATA_STACK_APP_NS', value: namespace });
		// envVars.push({ name: 'NODE_OPTIONS', value: `--max-old-space-size=${config.maxHeapSize}` });
		// envVars.push({ name: 'NODE_ENV', value: 'production' });
		envVars.push({ name: 'DATA_STACK_FLOW_ID', value: `${doc._id}` });
		envVars.push({ name: 'DATA_STACK_APP', value: `${doc.app}` });

		const options = {
			startupProbe: {
				httpGet: {
					path: '/api/b2b/internal/health/ready',
					port: +(port || 8080),
					scheme: 'HTTP'
				},
				initialDelaySeconds: 5,
				timeoutSeconds: 30,
				periodSeconds: 10,
				failureThreshold: 5
			}
		};

		const deployData = {
			apiVersion: 'apps/v1',
			kind: 'Deployment',
			metadata: {
				name: name,
				namespace: namespace
			},
			spec: {
				replicas: 1,
				selector: {
					matchLabels: {
						app: name
					}
				},
				template: {
					metadata: {
						labels: {
							app: name
						}
					},
					spec: {
						containers: [
							{
								name: name,
								image: flowBaseImage,
								ports: [
									{
										containerPort: port
									}
								],
								env: envVars
							}
						]
					}
				}
			}
		};
		if (options.livenessProbe) deployData.spec.template.spec.containers[0]['livenessProbe'] = options.livenessProbe;
		if (options.readinessProbe) deployData.spec.template.spec.containers[0]['readinessProbe'] = options.readinessProbe;
		if (options.readinessProbe) deployData.spec.template.spec.containers[0]['startupProbe'] = options.startupProbe;

		const serviceData = {
			apiVersion: 'v1',
			kind: 'Service',
			metadata: {
				name: name,
				namespace: namespace
			},
			spec: {
				type: 'ClusterIP',
				selector: {
					app: name
				},
				ports: [
					{
						protocol: 'TCP',
						port: 80,
						targetPort: port
					}
				]
			}
		};

		const serviceText = yamljs.stringify(serviceData);
		const deploymentText = yamljs.stringify(deployData);
		res.status(200).json({ service: serviceText, deployment: deploymentText });

	} catch (err) {
		logger.error(err);
		res.status(500).json({ message: err.message });
	}
});

module.exports = router;