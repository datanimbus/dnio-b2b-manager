const k8sClient = require('@appveen/data.stack-utils').kubeutil;
const config = require('../config');

const logger = global.logger;

async function upsertService(data) {
	try {
		let res = await k8sClient.service.getService(data.namespace, data.deploymentName);
		if (res.statusCode == 200) {
			res = await k8sClient.deployment.updateService(data.namespace, data.deploymentName, data.port);
		} else {
			res = await k8sClient.deployment.createService(data.namespace, data.deploymentName, data.port, config.release);
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
		const envKeys = ['FQDN', 'LOG_LEVEL', 'MONGO_APPCENTER_URL', 'MONGO_AUTHOR_DBNAME', 'MONGO_AUTHOR_URL', 'MONGO_LOGS_DBNAME', 'MONGO_LOGS_URL', 'MONGO_RECONN_TIME', 'MONGO_RECONN_TRIES', 'STREAMING_CHANNEL', 'STREAMING_HOST', 'STREAMING_PASS', 'STREAMING_RECONN_ATTEMPTS', 'STREAMING_RECONN_TIMEWAIT', 'STREAMING_USER', 'DATA_STACK_NAMESPACE', 'CACHE_CLUSTER', 'CACHE_HOST', 'CACHE_PORT', 'CACHE_RECONN_ATTEMPTS', 'CACHE_RECONN_TIMEWAIT_MILLI', 'RELEASE', 'TLS_REJECT_UNAUTHORIZED', 'API_REQUEST_TIMEOUT'];
		const envVars = {};
		for (let i in envKeys) {
			let val = envKeys[i];
			envVars[val] = process.env[val];
		}
		envVars['DATA_STACK_APP_NS'] = (config.DATA_STACK_NAMESPACE + '-' + data.app).toLowerCase();
		envVars['DATA_STACK_FLOW_ID'] = data._id;
		envVars['DATA_STACK_APP'] = data.app;

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
		if (res.statusCode == 200) {
			res = await k8sClient.deployment.updateDeployment(data.namespace, data.deploymentName, data.image, data.port, envVars, options);
		} else {
			res = await k8sClient.deployment.createDeployment(data.namespace, data.deploymentName, data.image, data.port, envVars, options, config.release);
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
		let res = await k8sClient.deployment.deleteService(data.namespace, data.deploymentName);
		return res;
	} catch (err) {
		logger.error('Error while trying to delete service');
		logger.error(err);
		throw err;
	}
}

module.exports.upsertService = upsertService;
module.exports.upsertDeployment = upsertDeployment;
module.exports.scaleDeployment = scaleDeployment;
module.exports.deleteDeployment = deleteDeployment;
module.exports.deleteService = deleteService;