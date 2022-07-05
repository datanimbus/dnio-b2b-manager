const { MongoClient } = require('mongodb');
const JWT = require('jsonwebtoken');
const log4js = require('log4js');

const config = require('./config');
const httpClient = require('./http-client');

const LOGGER_NAME = config.isK8sEnv() ? `[${config.hostname}] [INTEGRATION-FLOW v${config.imageTag}]` : `[INTEGRATION-FLOW v${config.imageTag}]`;
const logger = log4js.getLogger(LOGGER_NAME);
const token = JWT.sign({ name: 'B2B-MANAGER', _id: 'admin', isSuperAdmin: true }, config.RBAC_JWT_KEY, {});

// For threads to pick txnId and user headers
global.userHeader = 'user';
global.txnIdHeader = 'txnid';
global.loggerName = LOGGER_NAME;
global.trueBooleanValues = ['y', 'yes', 'true', '1'];
global.falseBooleanValues = ['n', 'no', 'false', '0'];
global.BM_TOKEN = token;

(async () => {
	try {
		logger.trace(config.mongoUrl, config.mongoAppCenterOptions, config.appDB);
		const client = await MongoClient.connect(config.mongoUrl, config.mongoAppCenterOptions);
		logger.info('Connected to ', config.appDB);
		const appcenterDB = client.db(config.appDB);
		global.appcenterDB = appcenterDB;
	} catch (err) {
		logger.error(err);
		process.exit(0);
	}
	if (process.env.NODE_ENV !== 'production') {
		logger.info(`NODE_ENV is ${process.env.NODE_ENV}. Won't call BM API.`);
	} else {
		try {
			let b2bBaseURL = config.baseUrlBM + '/' + config.app + '/flow/utils/' + config.flowId + '/init';
			logger.debug(`BM API Call :: ${config.baseUrlBM + '/' + config.app + '/flow/utils/' + config.flowId + '/init'}`);
			const resp = await httpClient.request({
				method: 'PUT',
				url: b2bBaseURL,
				headers: {
					'Content-Type': 'application/json'
				}
			});
			logger.debug(`BM API Call status :: ${resp.statusCode}`);
			logger.trace(`BM API Call response body :: ${resp.body}`);
		} catch (err) {
			logger.error('Unable to inform B2B Manager');
			logger.error(err);
		}
	}
})();