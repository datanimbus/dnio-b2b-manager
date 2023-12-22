const log4js = require('log4js');
const _ = require('lodash');
const k8sClient = require('@appveen/data.stack-utils').kubeutil;

const config = require('../config');

const logger = log4js.getLogger(global.loggerName);

async function getDeployment(data) {
	return await k8sClient.deployment.getDeployment(data.namespace, data.deploymentName);
}

async function upsertService(data) {
	try {
		let res = await k8sClient.service.getService(data.namespace, data.deploymentName);
		logger.debug('Service found for the name:', data.deploymentName, res.statusCode);
		logger.trace(`Service fetch status :: ${JSON.stringify(res)}`);

		if (res.statusCode == 200) {
			res = await k8sClient.service.updateService(data.namespace, data.deploymentName, (data.port || 8080));
			logger.debug('Service Update Status:', data.deploymentName, res.statusCode);
			logger.trace(`Service update status :: ${JSON.stringify(res)}`);
		} else {
			res = await k8sClient.service.createService(data.namespace, data.deploymentName, (data.port || 8080), config.release);
			logger.debug('Service Create Status:', data.deploymentName, res.statusCode);
			logger.trace(`Service create status :: ${JSON.stringify(res)}`);
		}
		return res;
	} catch (err) {
		logger.error('Error while trying to upsert Service');
		logger.error(err);
		throw err;
	}
}

async function upsertDeployment(data) {
	try {
		const envKeys = ['FQDN', 'LOG_LEVEL', 'MONGO_APPCENTER_URL', 'MONGO_AUTHOR_DBNAME', 'MONGO_AUTHOR_URL', 'MONGO_LOGS_DBNAME', 'MONGO_LOGS_URL', 'MONGO_RECONN_TIME', 'MONGO_RECONN_TRIES', 'STREAMING_CHANNEL', 'STREAMING_HOST', 'STREAMING_PASS', 'STREAMING_RECONN_ATTEMPTS', 'STREAMING_RECONN_TIMEWAIT', 'STREAMING_USER', 'DATA_STACK_NAMESPACE', 'CACHE_CLUSTER', 'CACHE_HOST', 'CACHE_PORT', 'CACHE_RECONN_ATTEMPTS', 'CACHE_RECONN_TIMEWAIT_MILLI', 'RELEASE', 'TLS_REJECT_UNAUTHORIZED', 'API_REQUEST_TIMEOUT', 'B2B_ALLOW_NPM_INSTALL', 'ENCRYPTION_KEY'];
		const envVars = [];
		for (let i in envKeys) {
			let val = envKeys[i];
			envVars.push({ name: val, value: process.env[val] });
		}
		envVars.push({ name: 'DATA_STACK_APP_NS', value: (config.DATA_STACK_NAMESPACE + '-' + data.app).toLowerCase() });
		envVars.push({ name: 'DATA_STACK_FLOW_ID', value: data._id });
		envVars.push({ name: 'DATA_STACK_APP', value: data.app });
		let envFrom = [];
		envFrom.push({
			type: 'secret',
			name: _.toLower(data.app)
		});
		let volumeMounts = {};
		if (data.volumeMounts && data.volumeMounts.length > 0) {
			data.volumeMounts.forEach((item) => {
				volumeMounts[item.name] = {
					mountType: item.mountType,
					containerPath: item.containerPath,
					hostPath: item.hostPath
				};
			});
		}

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
		let res = await k8sClient.deployment.getDeployment(data.namespace, data.deploymentName);
		logger.debug('Deployment found for the name:', data.deploymentName, res.statusCode, data.image);
		if (res.statusCode == 200) {
			res = await k8sClient.deployment.updateDeployment(data.namespace, data.deploymentName, data.image, (data.port || 8080), envVars, options, volumeMounts, envFrom);
			logger.debug('Deployment Update Status:', data.deploymentName, res.statusCode, data.image);
			res = await k8sClient.deployment.scaleDeployment(data.namespace, data.deploymentName, 0);
			logger.debug('Deployment Scaled to 0:', data.deploymentName, res.statusCode, data.image);
			res = await k8sClient.deployment.scaleDeployment(data.namespace, data.deploymentName, 1);
			logger.debug('Deployment Scaled to 1:', data.deploymentName, res.statusCode, data.image);
		} else {
			res = await k8sClient.deployment.createDeployment(data.namespace, data.deploymentName, data.image, (data.port || 8080), envVars, options, config.release, volumeMounts, envFrom);
			logger.debug('Deployment Create Status:', data.deploymentName, res.statusCode, data.image);
		}
		return res;
	} catch (err) {
		logger.error('Error while trying to upsert Deployment');
		logger.error(err);
		throw err;
	}
}

async function upsertFaasDeployment(data) {
	try {
		const envKeys = ['FQDN', 'LOG_LEVEL', 'MONGO_APPCENTER_URL', 'MONGO_AUTHOR_DBNAME', 'MONGO_AUTHOR_URL', 'MONGO_LOGS_DBNAME', 'MONGO_LOGS_URL', 'MONGO_RECONN_TIME', 'MONGO_RECONN_TRIES', 'STREAMING_CHANNEL', 'STREAMING_HOST', 'STREAMING_PASS', 'STREAMING_RECONN_ATTEMPTS', 'STREAMING_RECONN_TIMEWAIT', 'STREAMING_USER', 'DATA_STACK_NAMESPACE', 'CACHE_CLUSTER', 'CACHE_HOST', 'CACHE_PORT', 'CACHE_RECONN_ATTEMPTS', 'CACHE_RECONN_TIMEWAIT_MILLI', 'RELEASE', 'TLS_REJECT_UNAUTHORIZED', 'API_REQUEST_TIMEOUT'];
		const envVars = [];
		for (let i in envKeys) {
			let val = envKeys[i];
			envVars.push({ name: val, value: process.env[val] });
		}
		envVars.push({ name: 'DATA_STACK_APP_NS', value: (config.DATA_STACK_NAMESPACE + '-' + data.app).toLowerCase() });
		envVars.push({ name: 'FAAS_ID', value: data._id });
		envVars.push({ name: 'DATA_STACK_APP', value: data.app });
		let envFrom = [];
		envFrom.push({
			type: 'secret',
			name: _.toLower(data.app)
		});
		const options = {
			startupProbe: {
				httpGet: {
					path: '/api/faas/utils/health/ready',
					port: +(data.port || 8080),
					scheme: 'HTTP'
				},
				initialDelaySeconds: 5,
				timeoutSeconds: 30,
				periodSeconds: 10,
				failureThreshold: 5
			}
		};
		let res = await k8sClient.deployment.getDeployment(data.namespace, data.deploymentName);
		logger.debug('Deployment found for the name:', data.deploymentName, res.statusCode, data.image);
		logger.trace(`Deployment fetch status :: ${JSON.stringify(res)}`);
		if (res.statusCode == 200) {
			res = await k8sClient.deployment.updateDeployment(data.namespace, data.deploymentName, data.image, (data.port || 8080), envVars, options, null, envFrom);
			logger.debug('Deployment Update Status:', data.deploymentName, res.statusCode, data.image);
			logger.trace(`Deployment update status :: ${JSON.stringify(res)}`);

			res = await k8sClient.deployment.scaleDeployment(data.namespace, data.deploymentName, 0);
			logger.debug('Deployment Scaled to 0:', data.deploymentName, res.statusCode, data.image);
			logger.trace(`Deployment scaled to 0 status :: ${JSON.stringify(res)}`);

			res = await k8sClient.deployment.scaleDeployment(data.namespace, data.deploymentName, 1);
			logger.debug('Deployment Scaled to 1:', data.deploymentName, res.statusCode, data.image);
			logger.trace(`Deployment scaled to 1 status :: ${JSON.stringify(res)}`);
		} else {
			res = await k8sClient.deployment.createDeployment(data.namespace, data.deploymentName, data.image, (data.port || 8080), envVars, options, config.release, null, envFrom);
			logger.debug('Deployment Create Status:', data.deploymentName, res.statusCode, data.image);
			logger.trace(`Deployment create status :: ${JSON.stringify(res)}`);
		}
		return res;
	} catch (err) {
		logger.error('Error while trying to upsert Deployment');
		logger.error(err);
		throw err;
	}
}


async function scaleDeployment(data, value) {
	try {
		logger.debug(`Scaling Deployment :: ${data.namespace} :: ${data.deploymentName} :: ${value}`);
		let res = await k8sClient.deployment.scaleDeployment(data.namespace, data.deploymentName, value);
		return res;
	} catch (err) {
		logger.error('Error while trying to scale Deployment');
		logger.error(err);
		throw err;
	}
}

async function deleteDeployment(data) {
	try {
		logger.debug(`Deleting Deployment :: ${data.namespace} :: ${data.deploymentName}`);
		let res = await k8sClient.deployment.deleteDeployment(data.namespace, data.deploymentName);
		return res;
	} catch (err) {
		logger.error('Error while trying to delete Deployment');
		logger.error(err);
		throw err;
	}
}

async function deleteService(data) {
	try {
		logger.debug(`Deleting Service :: ${data.namespace} :: ${data.deploymentName}`);
		let res = await k8sClient.deployment.deleteService(data.namespace, data.deploymentName);
		return res;
	} catch (err) {
		logger.error('Error while trying to delete service');
		logger.error(err);
		throw err;
	}
}

module.exports.getDeployment = getDeployment;
module.exports.upsertService = upsertService;
module.exports.upsertDeployment = upsertDeployment;
module.exports.scaleDeployment = scaleDeployment;
module.exports.deleteDeployment = deleteDeployment;
module.exports.deleteService = deleteService;
module.exports.upsertFaasDeployment = upsertFaasDeployment;