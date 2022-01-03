const { MongoClient } = require('mongodb');
const log4js = require('log4js');

const config = require('./config');

const LOGGER_NAME = config.isK8sEnv() ? `[${config.hostname}] [B2B-MANAGER v${config.imageTag}]` : `[B2B-MANAGER v${config.imageTag}]`
const logger = log4js.getLogger(LOGGER_NAME);
logger.level = process.env.LOG_LEVEL || 'info';

// For threads to pick txnId and user headers
global.userHeader = 'user';
global.txnIdHeader = 'txnid';
global.loggerName = LOGGER_NAME;
// global.logger = logger;
// global.serviceCache = new NodeCache({ stdTTL: 60, checkperiod: 120, useClones: false });
// global.documentCache = new NodeCache({ stdTTL: 60, checkperiod: 120, useClones: false });
global.trueBooleanValues = ['y', 'yes', 'true', '1'];
global.falseBooleanValues = ['n', 'no', 'false', '0'];

(async () => {
	const client = await MongoClient.connect(config.mongoAuthorUrl, config.mongoAuthorOptions);
	logger.info('Connected to ', config.authorDB);
	const authorDB = client.db(config.authorDB);
	global.authorDB = authorDB;
	global.isTransactionAllowed = false;
	try {
		authorDB.admin().command({ 'replSetGetStatus': 1 }, async function (err, replicaSetStatus) {
			logger.trace('Replica Status :: ', replicaSetStatus);
			if (replicaSetStatus) {
				let dbVersion = (await authorDB.admin().serverInfo()).version;
				logger.debug('Author DB Version :: ', dbVersion);
				global.isTransactionAllowed = dbVersion && dbVersion >= '4.2.0';
			}
			global.client = require('./queue').init();
			logger.info('Are MongoDb Transactions Allowed :: ', global.isTransactionAllowed);
		});
	} catch (e) {
		logger.error('Error in setIsTransactionAllowed :: ', e);
	}
})();