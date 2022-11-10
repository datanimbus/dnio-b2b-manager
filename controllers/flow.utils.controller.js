const router = require('express').Router({ mergeParams: true });
const log4js = require('log4js');
const mongoose = require('mongoose');

// const codeGen = require('../code-gen/flows');
// const deployUtils = require('../utils/deploy.utils');
const k8sUtils = require('../utils/k8s.utils');
const queryUtils = require('../utils/query.utils');
const routerUtils = require('../utils/router.utils');
const config = require('../config');
const yamljs = require('json-to-pretty-yaml');

const logger = log4js.getLogger(global.loggerName);
const flowModel = mongoose.model('flow');

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
		const doc = await flowModel.findById(req.params.id).lean();
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Flow' });
		}
		// await codeGen.createProject(doc);
		if (config.isK8sEnv() && !doc.isBinary) {
			// const status = await deployUtils.deploy(doc, 'flow');
			doc.image = flowBaseImage;
			let status = await k8sUtils.upsertService(doc);
			status = await k8sUtils.upsertDeployment(doc);
			logger.info('Deploy API called');
			logger.debug(status);
			if (status.statusCode != 200 && status.statusCode != 202) {
				return res.status(status.statusCode).json({ message: 'Unable to deploy Flow' });
			}
			doc.status = 'Pending';
			doc.isNew = false;
			res.status(200).json({ message: 'Flow Deployed' });
		} else if (doc.isBinary) {
			doc.status = 'Active';
			doc.isNew = false;
			res.status(200).json({ message: 'Flow Deployed' });
		}
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
		const doc = await flowModel.findById(req.params.id).lean();
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Flow' });
		}
		// await codeGen.createProject(doc, req.header('txnId'));
		if (config.isK8sEnv()) {
			// const status = await deployUtils.repair(doc, 'flow');
			doc.image = flowBaseImage;
			let status = await k8sUtils.deleteDeployment(doc);
			status = await k8sUtils.deleteService(doc);
			status = await k8sUtils.upsertService(doc);
			status = await k8sUtils.upsertDeployment(doc);
			logger.info('Repair API called');
			logger.debug(status);
			if (status.statusCode !== 200 && status.statusCode !== 202) {
				return res.status(status.statusCode).json({ message: 'Unable to repair Flow' });
			}
		}
		doc.status = 'Pending';
		doc.isNew = false;
		doc._req = req;
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
		const doc = await flowModel.findById(req.params.id).lean();
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Flow' });
		}
		if (config.isK8sEnv() && !doc.isBinary) {
			// const status = await deployUtils.start(doc);
			const status = await k8sUtils.scaleDeployment(doc, 1);
			logger.info('Start API called');
			logger.debug(status);
			if (status.statusCode !== 200 && status.statusCode !== 202) {
				return res.status(status.statusCode).json({ message: 'Unable to start Flow' });
			}
		}
		doc.status = 'Pending';
		doc.isNew = false;
		doc._req = req;
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
	logger.info(`Flow stop request :: ${req.params.id}`);
	try {
		const doc = await flowModel.findById(req.params.id);
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Flow' });
		}
		if (config.isK8sEnv() && !doc.isBinary) {
			// const status = await deployUtils.stop(doc);
			const status = await k8sUtils.scaleDeployment(doc, 0);
			logger.info('Stop API called');
			logger.debug(status);
			if (status.statusCode !== 200 && status.statusCode !== 202) {
				logger.error('K8S :: Error stopping flow');
				return res.status(status.statusCode).json({ message: 'Unable to stop Flow' });
			}
		}
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

router.get('/:id/yamls', async (req, res) => {
	try {
		const doc = await flowModel.findById(req.params.id);

		const namespace = (config.DATA_STACK_NAMESPACE + '-' + doc.app).toLowerCase();
		const port = 80;
		const name = doc.deploymentName;
		const envKeys = ['FQDN', 'LOG_LEVEL', 'MONGO_APPCENTER_URL', 'MONGO_AUTHOR_DBNAME', 'MONGO_AUTHOR_URL', 'MONGO_LOGS_DBNAME', 'MONGO_LOGS_URL', 'MONGO_RECONN_TIME', 'MONGO_RECONN_TRIES', 'STREAMING_CHANNEL', 'STREAMING_HOST', 'STREAMING_PASS', 'STREAMING_RECONN_ATTEMPTS', 'STREAMING_RECONN_TIMEWAIT', 'STREAMING_USER', 'DATA_STACK_NAMESPACE', 'CACHE_CLUSTER', 'CACHE_HOST', 'CACHE_PORT', 'CACHE_RECONN_ATTEMPTS', 'CACHE_RECONN_TIMEWAIT_MILLI', 'RELEASE', 'TLS_REJECT_UNAUTHORIZED', 'API_REQUEST_TIMEOUT'];
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
					port: +(data.port || 8080),
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