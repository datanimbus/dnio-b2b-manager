const log4js = require('log4js');

const config = require('./config');
const httpClient = require('./http-client');

const logger = log4js.getLogger(global.loggerName);

async function getDataService(serviceId) {
	try {
		const options = {};
		options.url = config.baseUrlSM + '/service/' + serviceId;
		options.method = 'GET';
		options.headers = {};
		options.headers['Content-Type'] = 'application/json';
		options.headers['Authorization'] = 'JWT' + global.BM_TOKEN;
		const response = await httpClient.request(options);
		if (response.statusCode !== 200) {
			throw response.body;
		}
		return response.body;
	} catch (err) {
		logger.error(err);
		throw err;
	}
}


async function getFlow(flowId) {
	try {
		const options = {};
		options.url = config.baseUrlBM + '/flow/' + flowId;
		options.method = 'GET';
		options.headers = {};
		options.headers['Content-Type'] = 'application/json';
		options.headers['Authorization'] = 'JWT' + global.BM_TOKEN;
		const response = await httpClient.request(options);
		if (response.statusCode !== 200) {
			throw response.body;
		}
		return response.body;
	} catch (err) {
		logger.error(err);
		throw err;
	}
}

async function getFaaS(faasId) {
	try {
		const options = {};
		options.url = config.baseUrlBM + '/faas/' + faasId;
		options.method = 'GET';
		options.headers = {};
		options.headers['Content-Type'] = 'application/json';
		options.headers['Authorization'] = 'JWT' + global.BM_TOKEN;
		const response = await httpClient.request(options);
		if (response.statusCode !== 200) {
			throw response.body;
		}
		return response.body;
	} catch (err) {
		logger.error(err);
		throw err;
	}
}




module.exports.getDataService = getDataService;
module.exports.getFlow = getFlow;
module.exports.getFaaS = getFaaS;