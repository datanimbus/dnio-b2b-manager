const log4js = require('log4js');
const LOG_LEVEL = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info';
let version = require('./package.json').version;

log4js.configure({
    appenders: { out: { type: 'stdout', layout: { type: 'basic' } } },
    categories: { default: { appenders: ['out'], level: LOG_LEVEL } }
});
const dataStackUtils = require('@appveen/data.stack-utils');

// const LOGGER_NAME = isK8sEnv() ? `[${process.env.HOSTNAME}] [B2B-MANAGER v${process.env.IMAGE_TAG}]` : `[B2B-MANAGER v${process.env.IMAGE_TAG}]`;

const LOGGER_NAME = isK8sEnv() ? `[${process.env.DATA_STACK_NAMESPACE}] [${process.env.HOSTNAME}] [BM ${version}]` : `[BM ${version}]`;
global.loggerName = LOGGER_NAME;
const logger = log4js.getLogger(LOGGER_NAME);

global.logger = logger;

let envVariables = {};

const DATA_STACK_NAMESPACE = process.env.DATA_STACK_NAMESPACE || 'appveen';

if (process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT) {
    dataStackUtils.kubeutil.check()
        .then(
            () => logger.info('Connection to Kubernetes APi server successful!'),
            _e => {
                logger.error('ERROR :: Unable to connect to Kubernetes API server');
                logger.log(_e.message);
            });
}

function isK8sEnv() {
    return process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT;
}

if (isK8sEnv()) {
    logger.info('*** K8s environment detected ***');
    logger.info('Image version: ' + process.env.IMAGE_TAG);
} else {
    logger.info('*** Local environment detected ***');
}

function parseBoolean(val) {
    if (typeof val === 'boolean') return val;
    else if (typeof val === 'string') {
        return val.toLowerCase() === 'true';
    } else {
        return false;
    }
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

async function fetchEnvironmentVariablesFromDB() {
    try {
        envVariables = await dataStackUtils.database.fetchEnvVariables();
		return envVariables;
    } catch (error) {
        logger.error(error);
        logger.error('Fetching environment variables failed. Crashing the component.');
        process.exit(1);
    }
}

if (isK8sEnv() && !DATA_STACK_NAMESPACE) throw new Error('DATA_STACK_NAMESPACE not found. Please check your configMap');


module.exports = {
    imageTag: process.env.IMAGE_TAG,
    hostname: process.env.HOSTNAME,
    release: envVariables.RELEASE,
    port: process.env.PORT || 10011,
    httpsPort: process.env.HTTPS_PORT || 10443,
    baseUrlSM: get('sm') + '/sm',
    baseUrlNE: get('ne') + '/ne',
    baseUrlUSR: get('user') + '/rbac',
    baseUrlBM: get('bm') + '/bm',
    baseUrlSEC: get('sec') + '/sec',
    baseUrlDM: get('dm') + '/dm',
    maxHeapSize: envVariables.NODE_MAX_HEAP_SIZE || '4096',
    isK8sEnv: isK8sEnv,
    logQueueName: 'systemService',
    DATA_STACK_NAMESPACE,
    mongoUrl: process.env.MONGO_APPCENTER_URL || 'mongodb://localhost',
    authorDB: process.env.MONGO_AUTHOR_DBNAME || 'datastackConfig',
    mongoAuthorUrl: process.env.MONGO_AUTHOR_URL || 'mongodb://localhost',
    mongoLogUrl: process.env.MONGO_LOGS_URL || 'mongodb://localhost',
    logsDB: process.env.MONGO_LOGS_DBNAME || 'datastackLogs',
    googleKey: envVariables.GOOGLE_API_KEY || '',
    queueName: 'webHooks',
    interactionLogQueueName: 'interactionLogs',
    interactionQueueName: 'interaction',
    eventsQueueName: 'events',
    faasLastInvokedQueue: 'faasLastInvoked',
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
    },
    TZ_DEFAULT: envVariables.TZ_DEFAULT || 'Zulu',
    agentMonitoringExpiry: process.env.B2B_HB_LOG_EXPIRY ? parseInt(process.env.B2B_HB_LOG_EXPIRY) : 30 * 60,
    maxFileSize: envVariables.B2B_AGENT_MAX_FILE_SIZE ? getFileSize(envVariables.B2B_AGENT_MAX_FILE_SIZE) : 1000 * 1024 * 1024,
    logRotationType: envVariables.B2B_AGENT_LOG_ROTATION_TYPE || 'days',
    logRetentionCount: envVariables.B2B_AGENT_LOG_RETENTION_COUNT || 10,
    logMaxFileSize: envVariables.B2B_AGENT_LOG_MAX_FILE_SIZE ? getFileSize(envVariables.B2B_AGENT_LOG_MAX_FILE_SIZE) : 10 * 1024 * 1024,
    B2B_FLOW_REJECT_ZONE_ACTION: process.env.B2B_FLOW_REJECT_ZONE_ACTION || 'queue',
    B2B_FLOW_MAX_CONCURRENT_FILES: parseInt(envVariables.B2B_FLOW_MAX_CONCURRENT_FILES || '0'),
    uploadRetryCounter: envVariables.B2B_UPLOAD_RETRY_COUNTER || '5',
    downloadRetryCounter: envVariables.B2B_DOWNLOAD_RETRY_COUNTER || '5',
    maxConcurrentUploads: parseInt(process.B2B_DEFAULT_CONCURRENT_FILE_UPLOADS || 5),
    maxConcurrentDownloads: parseInt(process.B2B_DEFAULT_CONCURRENT_FILE_DOWNLOADS || 5),
    B2B_ENABLE_TIMEBOUND: parseBoolean(process.env.B2B_ENABLE_TIMEBOUND),
    B2B_ENABLE_TRUSTED_IP: parseBoolean(envVariables.B2B_ENABLE_TRUSTED_IP),
    RBAC_JWT_KEY: envVariables.RBAC_JWT_KEY || 'u?5k167v13w5fhjhuiweuyqi67621gqwdjavnbcvadjhgqyuqagsduyqtw87e187etqiasjdbabnvczmxcnkzn',
    MAX_JSON_SIZE: envVariables.MAX_JSON_SIZE || '5mb',
    encryptionKey: process.env.ENCRYPTION_KEY || '34857057658800771270426551038148',
    gwFQDN: process.env.FQDN || 'localhost',
    hbFrequency: envVariables.B2B_HB_FREQUENCY ? parseInt(envVariables.B2B_HB_FREQUENCY) : 10,
    hbMissCount: envVariables.B2B_HB_MISSED_COUNT ? parseInt(envVariables.B2B_HB_MISSED_COUNT) : 10,
    flowPendingWaitTime: envVariables.B2B_FLOW_PENDING_WAIT_TIME ? parseInt(envVariables.B2B_FLOW_PENDING_WAIT_TIME) : 10,
    encryptFile: envVariables.B2B_ENCRYPT_FILE || 'true',
    retainFileOnSuccess: envVariables.B2B_RETAIN_FILE_ON_SUCCESS || 'true',
    retainFileOnError: envVariables.B2B_RETAIN_FILE_ON_ERROR || 'true',
    b2bFlowFsMountPath: envVariables.B2B_FLOW_FS_MOUNT_PATH || '/tmp',
    B2B_ALLOW_NPM_INSTALL: parseBoolean(process.env.B2B_ALLOW_NPM_INSTALL) || true,
    B2B_TRANSFER_LEDGER_ENTRY_TTL: process.env.B2B_TRANSFER_LEDGER_ENTRY_TTL ? parseInt(process.env.B2B_TRANSFER_LEDGER_ENTRY_TTL) : 604800,
    B2B_AGENT_LOGS_TTL_DAYS: process.env.B2B_AGENT_LOGS_TTL_DAYS ? parseInt(process.env.B2B_AGENT_LOGS_TTL_DAYS) : 1,
    envVarsForFlows: ['FQDN', 'LOG_LEVEL', 'MONGO_APPCENTER_URL', 'MONGO_AUTHOR_DBNAME', 'MONGO_AUTHOR_URL', 'MONGO_LOGS_DBNAME', 'MONGO_LOGS_URL', 'MONGO_RECONN_TIME', 'MONGO_RECONN_TRIES', 'STREAMING_CHANNEL', 'STREAMING_HOST', 'STREAMING_PASS', 'STREAMING_RECONN_ATTEMPTS', 'STREAMING_RECONN_TIMEWAIT', 'STREAMING_USER', 'DATA_STACK_NAMESPACE', 'CACHE_CLUSTER', 'CACHE_HOST', 'CACHE_PORT', 'CACHE_RECONN_ATTEMPTS', 'CACHE_RECONN_TIMEWAIT_MILLI', 'RELEASE', 'TLS_REJECT_UNAUTHORIZED', 'API_REQUEST_TIMEOUT', 'B2B_ALLOW_NPM_INSTALL', 'ENCRYPTION_KEY'],
    fetchEnvironmentVariablesFromDB: fetchEnvironmentVariablesFromDB
};

function getFileSize(size) {
    let factor = 1;
    let unit = size.substr(size.length - 1);
    let s = parseInt(size.substr(0, size.length - 1));
    if (unit.toLowerCase() == 'k') factor *= 1024;
    if (unit.toLowerCase() == 'm') factor *= (1024 * 1024);
    return s * factor;
}