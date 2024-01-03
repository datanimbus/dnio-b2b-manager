const router = require('express').Router({ mergeParams: true });
const log4js = require('log4js');
const mongoose = require('mongoose');
const yamljs = require('json-to-pretty-yaml');
const _ = require('lodash');

const config = require('../config');
const k8sUtils = require('../utils/k8s.utils');
const queryUtils = require('../utils/query.utils');
const commonUtils = require('../utils/common.utils');
const helpers = require('../utils/helper');

const logger = log4js.getLogger(global.loggerName);
const bundleModel = mongoose.model('bundle-deployment');
const flowModel = mongoose.model('flow');
const agentActionModel = mongoose.model('agent-action');

let dockerRegistryType = process.env.DOCKER_REGISTRY_TYPE ? process.env.DOCKER_REGISTRY_TYPE : '';
if (dockerRegistryType.length > 0) dockerRegistryType = dockerRegistryType.toUpperCase();

let dockerReg = process.env.DOCKER_REGISTRY_SERVER ? process.env.DOCKER_REGISTRY_SERVER : '';
if (dockerReg.length > 0 && !dockerReg.endsWith('/') && dockerRegistryType != 'ECR') dockerReg += '/';

let flowBaseImage = `${dockerReg}datanimbus.io.b2b.base:${config.imageTag}`;
if (dockerRegistryType == 'ECR') flowBaseImage = `${dockerReg}:datanimbus.io.b2b.base:${config.imageTag}`;

router.get('/', async (req, res) => {
	try {
		const filter = queryUtils.parseFilter(req.query.filter);
		if (req.query.countOnly) {
			const count = await bundleModel.countDocuments(filter);
			return res.status(200).json(count);
		}
		const data = queryUtils.getPaginationData(req);
		const docs = await bundleModel.find(filter).select(data.select).sort(data.sort).skip(data.skip).limit(data.count).lean();
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
		let mongoQuery = bundleModel.findById(req.params.id);
		if (req.query.select) {
			mongoQuery = mongoQuery.select(req.query.select);
		}
		let doc = await mongoQuery.lean();
		if (!doc) {
			return res.status(404).json({
				message: 'Document Not Found'
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
		const payload = req.body;
		payload.app = payload.app || req.locals.app;
		let doc = new bundleModel(payload);
		doc._req = req;
		const status = await doc.save();
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
		const payload = req.body;
		let doc = await bundleModel.findById(req.params.id);
		if (!doc) {
			return res.status(404).json({
				message: 'Document Not Found'
			});
		}
		delete payload._metadata;
		delete payload.__v;
		delete payload.version;
		Object.keys(payload).forEach(key => {
			doc[key] = payload[key];
		});
		// _.merge(doc, payload);
		doc._req = req;
		const status = await doc.save();
		res.status(200).json(status);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.delete('/:id', async (req, res) => {
	try {
		let doc = await bundleModel.findById(req.params.id);
		if (!doc) {
			return res.status(404).json({
				message: 'Document Not Found'
			});
		}
		doc._req = req;
		await doc.remove();
		res.status(200).json({
			message: 'Document Deleted'
		});
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.put('/utils/:id/start', async (req, res) => {
	try {
		let id = req.params.id;
		let txnId = req.get('TxnId');
		let socket = req.app.get('socket');
		logger.info(`[${txnId}] Bundle start request received :: ${id}`);
		const bundleDoc = await bundleModel.findById(req.params.id);
		if (!bundleDoc) {
			return res.status(400).json({ message: 'Invalid Bundle' });
		}
		const flowList = await flowModel.find({ _id: { $in: bundleDoc.bundle } }).exec();
		const appData = await commonUtils.getApp(req, bundleDoc.app);
		if (appData.body.b2bBaseImage) {
			flowBaseImage = appData.body.b2bBaseImage;
		}
		bundleDoc.image = flowBaseImage;
		logger.debug(`[${txnId}] Bundle data found for id :: ${id}`);
		logger.trace(`[${txnId}] Bundle data :: ${JSON.stringify(bundleDoc)}`);

		logger.info(`[${txnId}] Scaling up deployment :: ${bundleDoc.deploymentName}`);
		bundleDoc.volumeMounts = _.flatten(flowList.map(e => e.volumeMounts));
		if (config.isK8sEnv()) {
			const status = await k8sUtils.upsertBundleDeployment(bundleDoc);
			logger.trace(`[${txnId}] Deployment Scaled status :: ${JSON.stringify(status)}`);
			if (status.statusCode !== 200 && status.statusCode !== 202) {
				return res.status(status.statusCode).json({ message: 'Unable to start Bundle' });
			}
		}
		let promises = flowList.map(async (doc) => {
			try {
				let payload = {};
				payload.name = doc.deploymentName;
				payload.namespace = bundleDoc.namespace;
				payload.selector = bundleDoc.deploymentName;
				payload.port = 8080;
				const status = await k8sUtils.upsertBundleService(payload);
				logger.trace(`[${txnId}] Deployment Scaled status :: ${JSON.stringify(status)}`);
				doc.status = 'Pending';
				doc.isNew = false;
				doc._req = req;
				await doc.save();
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
			} catch (err) {
				logger.error(err);
			}
		});
		await Promise.all(promises);
		res.status(200).json({ message: 'Bundle Started' });
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

router.put('/utils/:id/stop', async (req, res) => {
	try {
		let id = req.params.id;
		let txnId = req.get('TxnId');
		let socket = req.app.get('socket');
		logger.info(`[${txnId}] Bundle stop request received :: ${id}`);

		const bundleDoc = await bundleModel.findById(id);
		if (!bundleDoc) {
			return res.status(400).json({ message: 'Invalid Bundle' });
		}

		logger.debug(`[${txnId}] Bundle data found for id :: ${id}`);
		logger.trace(`[${txnId}] Bundle data :: ${JSON.stringify(bundleDoc)}`);

		logger.info(`[${txnId}] Scaling down deployment :: ${JSON.stringify({ namespace: bundleDoc.namespace, deploymentName: bundleDoc.deploymentName })}`);

		if (config.isK8sEnv()) {
			const status = await k8sUtils.scaleDeployment(bundleDoc, 0);
			logger.info('Stop API called');
			logger.debug(status);
			if (status.statusCode !== 200 && status.statusCode !== 202) {
				logger.error('K8S :: Error stopping Bundle');
				return res.status(status.statusCode).json({ message: 'Unable to stop Bundle' });
			}
		}
		const flowList = await flowModel.find({ _id: { $in: bundleDoc.bundle } }).exec();
		let promises = flowList.map(async (doc) => {
			try {
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
			} catch (err) {
				logger.error(err);
			}
		});
		await Promise.all(promises);
		res.status(200).json({ message: 'Bundle Stopped' });
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

router.get('/utils/:id/yamls', async (req, res) => {
	try {
		const doc = await flowModel.findById(req.params.id);
		const appData = await commonUtils.getApp(req, doc.app);
		if (appData.body.b2bBaseImage) {
			flowBaseImage = appData.body.b2bBaseImage;
		}
		const namespace = (config.DATA_STACK_NAMESPACE + '-' + doc.app).toLowerCase();
		const port = 8080;
		const name = doc.deploymentName;
		const envVars = [];
		envVars.push({ name: 'DATA_STACK_APP_NS', value: namespace });
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