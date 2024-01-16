const mongoose = require('mongoose');
const log4js = require('log4js');

const config = require('./config');
const { fetchEnvironmentVariablesFromDB } = require('./config');
const models = require('./models');
const queue = require('./queue');
const init = require('./init');

let logger = global.logger;

// let baseImageVersion = require('./package.json').version;
// const LOGGER_NAME = config.isK8sEnv() ? `[${config.appNamespace}] [${config.hostname}] [${config.serviceName} v${config.serviceVersion}]` : `[${config.serviceName} v${config.serviceVersion}]`

// For threads to pick txnId and user headers
global.userHeader = 'user';
global.txnIdHeader = 'txnId';
global.trueBooleanValues = ['y', 'yes', 'true', '1'];
global.falseBooleanValues = ['n', 'no', 'false', '0'];


// const appcenterCon = mongoose.createConnection(config.mongoUrl, config.mongoAppCenterOptions);
const appcenterCon = mongoose.createConnection(config.dbAppcenterUrl, config.dbAppcenterOptions);
appcenterCon.on('connecting', () => { logger.info(' *** Appcenter DB CONNECTING *** '); });
appcenterCon.on('disconnected', () => { logger.error(' *** Appcenter DB LOST CONNECTION *** '); });
appcenterCon.on('reconnect', () => { logger.info(' *** Appcenter DB RECONNECTED *** '); });
appcenterCon.on('connected', () => { logger.info('Connected to Appcenter DB DB'); global.appcenterCon = appcenterCon; global.dbAppcenterConnection = appcenterCon; });
appcenterCon.on('reconnectFailed', () => { logger.error(' *** Appcenter DB FAILED TO RECONNECT *** '); });

// const logsDB = mongoose.createConnection(config.mongoLogUrl, config.mongoLogsOptions);
const logsDB = mongoose.createConnection(config.dbLogsUrl, config.dbLogsOptions);
logsDB.on('connecting', () => { logger.info(` *** ${config.dbLogsOptions.dbName} CONNECTING *** `); });
logsDB.on('disconnected', () => { logger.error(` *** ${config.dbLogsOptions.dbName} LOST CONNECTION *** `); });
logsDB.on('reconnect', () => { logger.info(` *** ${config.dbLogsOptions.dbName} RECONNECTED *** `); });
logsDB.on('connected', () => { logger.info(`Connected to ${config.dbLogsOptions.dbName} DB`); global.logsDB = logsDB; global.dbLogsConnection = logsDB; });
logsDB.on('reconnectFailed', () => { logger.error(` *** ${config.dbLogsOptions.dbName} FAILED TO RECONNECT *** `); });

// mongoose.connect(config.mongoAuthorUrl, config.mongoAuthorOptions).then(async () => {
// 	global.authorDB = mongoose.connection.db;
// 	mongoose.connection.db.collection('av-cache').createIndex({ timestamp: 1 }, { expireAfterSeconds: 10 });
// 	await fetchEnvironmentVariablesFromDB();
// }).catch(err => {
// 	logger.error(err);
// 	process.exit(0);
// });

mongoose.connect(config.dbAuthorUrl, config.dbAuthorOptions).then(async () => {
	global.authorDB = mongoose.connection.db;
	global.dbAuthorConnection = mongoose.connection.db;
	mongoose.connection.db.collection('av-cache').createIndex({ timestamp: 1 }, { expireAfterSeconds: 10 });
	await fetchEnvironmentVariablesFromDB();
}).catch(err => {
	logger.error(err);
	process.exit(0);
});

mongoose.connection.on('connecting', () => { logger.info(` *** ${config.dbAuthorOptions.dbName} CONNECTING *** `); });
mongoose.connection.on('disconnected', () => { logger.error(` *** ${config.dbAuthorOptions.dbName} LOST CONNECTION *** `); });
mongoose.connection.on('reconnect', () => { logger.info(` *** ${config.dbAuthorOptions.dbName} RECONNECTED *** `); });
mongoose.connection.on('connected', () => { logger.info(`Connected to ${config.dbAuthorOptions.dbName} DB`); });
mongoose.connection.on('reconnectFailed', () => { logger.error(` *** ${config.dbAuthorOptions.dbName} FAILED TO RECONNECT *** `); });

queue.init();
models.init();
init.init();