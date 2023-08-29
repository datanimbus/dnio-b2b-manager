const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const log4js = require('log4js');
const { zip } = require('zip-a-folder');
const FormData = require('form-data');

const dataStackUtils = require('@appveen/data.stack-utils');

const config = require('../config');
const httpClient = require('../http-client');

// const deploymentUrlCreate = config.baseUrlDM + '/deployment';
const deploymentUrlUpdate = config.baseUrlDM + '/updateDeployment';
// const deploymentApiChange = config.baseUrlDM + '/apiChange';
const kubeutil = dataStackUtils.kubeutil;

const logger = log4js.getLogger(global.loggerName);

async function deploy(data, type) {
	const id = data._id;
	let folderPath;
	let zipPath;
	let healthAPI;
	if (type == 'flow') {
		folderPath = path.join(process.cwd(), 'generatedFlows', data._id);
		zipPath = path.join(process.cwd(), 'generatedFlows', data._id + '_' + data.version + '.zip');
		healthAPI = '/api/b2b/internal/health/ready';
	} else {
		folderPath = path.join(process.cwd(), 'generatedFaas', data._id);
		zipPath = path.join(process.cwd(), 'generatedFaas', data._id + '_' + data.version + '.zip');
		healthAPI = '/api/faas/internal/health/ready';
	}
	const deploymentUrl = deploymentUrlUpdate;
	const deployNamespace = config.DATA_STACK_NAMESPACE + '-' + data.app.toLowerCase().replace(/ /g, '');
	await kubeutil.service.deleteService(deployNamespace, data.deploymentName);
	await kubeutil.deployment.deleteDeployment(deployNamespace, data.deploymentName);

	const envKeys = ['FQDN', 'LOG_LEVEL', 'MONGO_APPCENTER_URL', 'MONGO_AUTHOR_DBNAME', 'MONGO_AUTHOR_URL', 'MONGO_LOGS_DBNAME', 'MONGO_LOGS_URL', 'MONGO_RECONN_TIME', 'MONGO_RECONN_TRIES', 'STREAMING_CHANNEL', 'STREAMING_HOST', 'STREAMING_PASS', 'STREAMING_RECONN_ATTEMPTS', 'STREAMING_RECONN_TIMEWAIT', 'STREAMING_USER', 'DATA_STACK_NAMESPACE', 'CACHE_CLUSTER', 'CACHE_HOST', 'CACHE_PORT', 'CACHE_RECONN_ATTEMPTS', 'CACHE_RECONN_TIMEWAIT_MILLI', 'RELEASE', 'TLS_REJECT_UNAUTHORIZED', 'API_REQUEST_TIMEOUT'];
	const envObj = {};
	for (let i in envKeys) {
		let val = envKeys[i];
		envObj[val] = process.env[val];
	}
	if (type == 'flow') {
		envObj['B2B_ALLOW_NPM_INSTALL'] = process.env['B2B_ALLOW_NPM_INSTALL'];
		envObj['ENCRYPTION_KEY'] = process.env['ENCRYPTION_KEY'];
	}
	envObj['DATA_STACK_APP_NS'] = (config.DATA_STACK_NAMESPACE + '-' + data.app).toLowerCase();
	logger.debug('***************************************************');
	logger.debug('port', data.port);
	logger.debug('***************************************************');
	await zipAFolder(folderPath, zipPath);
	const formData = new FormData();
	formData.append('deployment', JSON.stringify({
		image: id,
		imagePullPolicy: 'Always',
		namespace: deployNamespace,
		port: +(data.port || 8080),
		name: data.deploymentName,
		version: data.version,
		envVars: envObj,
		volumeMounts: {
		},
		options: {
			startupProbe: {
				httpGet: {
					path: healthAPI,
					port: +(data.port || 8080),
					scheme: 'HTTP'
				},
				initialDelaySeconds: 5,
				timeoutSeconds: 30,
				periodSeconds: 10,
				failureThreshold: 5
			}
		}
	}));
	formData.append('file', fs.createReadStream(zipPath));
	try {
		const httpResponse = await httpClient.httpRequest({
			method: 'POST',
			url: deploymentUrl,
			body: formData
		});
		if (httpResponse.statusCode >= 400) {
			let errorMsg = httpResponse.body && httpResponse.body.message ? httpResponse.body.message : 'DM returned statusCode ' + httpResponse.statusCode;
			logger.error(errorMsg);
			throw new Error(errorMsg);
		}
		logger.info('Upload successful!  Server responded with:', httpResponse.body);
		try {
			deleteProjectFolder(folderPath);
			removeFile(zipPath);
		} catch (err) {
			logger.warn('Unable to delete folders');
			logger.error(err);
		}
		return { statusCode: 200, body: { message: 'Process queued in DM' } };
	} catch (err) {
		logger.error('upload failed:', err);
		throw err;
	}
}

async function repair(data, type) {
	return await deploy(data, type);
}


async function start(data) {
	const deployNamespace = config.DATA_STACK_NAMESPACE + '-' + data.app.toLowerCase().replace(/ /g, '');
	const status = await kubeutil.deployment.scaleDeployment(deployNamespace, data.deploymentName, 1);
	logger.info(`Namespace ${deployNamespace} :: Deployment ${data.deploymentName} Scaled to 1`);
	logger.debug(JSON.stringify(status));
	return status;
}

async function stop(data) {
	const deployNamespace = config.DATA_STACK_NAMESPACE + '-' + data.app.toLowerCase().replace(/ /g, '');
	const status = await kubeutil.deployment.scaleDeployment(deployNamespace, data.deploymentName, 0);
	logger.info(`Namespace ${deployNamespace} :: Deployment ${data.deploymentName} Scaled to 0`);
	logger.debug(JSON.stringify(status));
	return status;
}


async function scale(data, scaleValue) {
	const deployNamespace = config.DATA_STACK_NAMESPACE + '-' + data.app.toLowerCase().replace(/ /g, '');
	const status = await kubeutil.deployment.scaleDeployment(deployNamespace, data.deploymentName, scaleValue);
	logger.info(`Namespace ${deployNamespace} :: Deployment ${data.deploymentName} Scaled to ${scaleValue}`);
	logger.debug(JSON.stringify(status));
	return status;
}


async function undeploy(data) {
	const deployNamespace = config.DATA_STACK_NAMESPACE + '-' + data.app.toLowerCase().replace(/ /g, '');
	let status = await kubeutil.service.deleteService(deployNamespace, data.deploymentName);
	logger.info(`Namespace ${deployNamespace} :: Service Deleted  ${data.deploymentName}`);
	logger.debug(JSON.stringify(status));
	status = await kubeutil.deployment.deleteDeployment(deployNamespace, data.deploymentName);
	logger.info(`Namespace ${deployNamespace} :: Deployment Deleted ${data.deploymentName}`);
	logger.debug(JSON.stringify(status));
	return status;
}




function zipAFolder(src, dest) {
	return zip(src, dest);
}

function deleteProjectFolder(path) {
	try {
		fse.removeSync(path);
	} catch (e) {
		logger.warn(e);
	}
}


function removeFile(path) {
	try {
		fse.unlinkSync(path);
	} catch (e) {
		logger.warn(e);
	}
}





module.exports.deploy = deploy;
module.exports.repair = repair;
module.exports.start = start;
module.exports.stop = stop;
module.exports.scale = scale;
module.exports.undeploy = undeploy;