const log4js = require('log4js');

let logLevel = process.env.LOG_LEVEL || 'info';

if (process.env.NODE_ENV !== 'production') logLevel = 'trace';

log4js.configure({
	'appenders': {
		'out': {
			'type': 'stdout',
			'layout': { type: 'coloured' }
		}
	},
	'categories': {
		'default': {
			'appenders': ['out'],
			'level': logLevel
		}
	}
});

const logger = log4js.getLogger('Config');

logger.info(`NODE_ENV :: ${process.env.NODE_ENV}`);
logger.info(`LOG_LEVEL :: ${logLevel}`);

const DATA_STACK_NAMESPACE = process.env.DATA_STACK_NAMESPACE || 'appveen';

function isK8sEnv() {
	return process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT;
}

function get(_service) {
	if (isK8sEnv()) {
		if (_service == 'ne') return `http://ne.${DATA_STACK_NAMESPACE}`;
		if (_service == 'sm') return `http://sm.${DATA_STACK_NAMESPACE}`;
		if (_service == 'dm') return `http://dm.${DATA_STACK_NAMESPACE}`;
		if (_service == 'user') return `http://user.${DATA_STACK_NAMESPACE}`;
		if (_service == 'gw') return `http://gw.${DATA_STACK_NAMESPACE}`;
		if (_service == 'sec') return `http://sec.${DATA_STACK_NAMESPACE}`;
		if (_service == 'bm') return `http://bm.${DATA_STACK_NAMESPACE}`;
	} else {
		if (_service == 'ne') return 'http://localhost:10010';
		if (_service == 'sm') return 'http://localhost:10003';
		if (_service == 'dm') return 'http://localhost:10709';
		if (_service == 'user') return 'http://localhost:10004';
		if (_service == 'gw') return 'http://localhost:9080';
		if (_service == 'sec') return 'http://localhost:10007';
		if (_service == 'bm') return 'http://localhost:10011';
	}
}

if (isK8sEnv()) {
	logger.info('*** K8s environment detected ***');
	logger.info('Image version: ' + (process.env.IMAGE_TAG || 'dev'));
} else {
	logger.info('*** Local environment detected ***');
}

const e = {
	baseUrlSM: get('sm') + '/sm',
	baseUrlNE: get('ne') + '/ne',
	baseUrlUSR: get('user') + '/rbac',
	baseUrlBM: get('bm') + '/bm',
	baseUrlSEC: get('sec') + '/sec',
	baseUrlDM: get('dm') + '/dm',
	isK8sEnv,
	imageTag: process.env.IMAGE_TAG || 'dev',
	hostname: process.env.HOSTNAME,
	port: process.env.PORT || 8080,
	httpsPort: process.env.HTTPS_PORT || 8443,
	app: process.env.DATA_STACK_APP,
	appDB: process.env.DATA_DB || 'datastackB2B',
	appNamespace: process.env.DATA_STACK_FLOW_NAMESPACE,
	flowId: process.env.DATA_STACK_FLOW_ID,
	DATA_STACK_NAMESPACE,
	TOKEN_SECRET: process.env.TOKEN_SECRET || 'u?5k167v13w5fhjhuiweuyqi67621gqwdjavnbcvadjhgqyuqagsduyqtw87e187etqiasjdbabnvczmxcnkzn',
	mongoUrl: process.env.MONGO_APPCENTER_URL || 'mongodb://localhost',
	authorDB: process.env.MONGO_AUTHOR_DBNAME || 'datastackConfig',
	mongoAuthorUrl: process.env.MONGO_AUTHOR_URL || 'mongodb://localhost',
	mongoLogUrl: process.env.MONGO_LOGS_URL || 'mongodb://localhost',
	logsDB: process.env.MONGO_LOGS_DBNAME || 'datastackLogs',
	googleKey: process.env.GOOGLE_API_KEY || '',
	queueName: 'webHooks',
	streamingConfig: {
		url: process.env.STREAMING_HOST || 'nats://127.0.0.1:4222',
		user: process.env.STREAMING_USER || '',
		pass: process.env.STREAMING_PASS || '',
		// maxReconnectAttempts: process.env.STREAMING_RECONN_ATTEMPTS || 500,
		// reconnectTimeWait: process.env.STREAMING_RECONN_TIMEWAIT_MILLI || 500
		maxReconnectAttempts: process.env.STREAMING_RECONN_ATTEMPTS || 500,
		connectTimeout: 2000,
		stanMaxPingOut: process.env.STREAMING_RECONN_TIMEWAIT_MILLI || 500
	},
	mongoAuthorOptions: {
		useUnifiedTopology: true,
		useNewUrlParser: true,
		dbName: process.env.MONGO_AUTHOR_DBNAME || 'datastackConfig',
	},
	mongoAppCenterOptions: {
		useUnifiedTopology: true,
		useNewUrlParser: true,
	},
	mongoLogsOptions: {
		useUnifiedTopology: true,
		useNewUrlParser: true,
		dbName: process.env.MONGO_LOGS_DBNAME || 'datastackLogs'
	}
};

module.exports = e;