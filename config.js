const log4js = require('log4js');
const dataStackUtils = require('@appveen/data.stack-utils');

const LOGGER_NAME = isK8sEnv() ? `[${process.env.HOSTNAME}] [B2B-MANAGER v${process.env.IMAGE_TAG}]` : `[B2B-MANAGER v${process.env.IMAGE_TAG}]`;
const logger = log4js.getLogger(LOGGER_NAME);
const DATA_STACK_NAMESPACE = process.env.DATA_STACK_NAMESPACE;

logger.debug(`DATA_STACK_NAMESPACE : ${process.env.DATA_STACK_NAMESPACE}`);

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
        if (_service == 'pm') return `http://pm.${DATA_STACK_NAMESPACE}`;
    } else {
        if (_service == 'ne') return 'http://localhost:10010';
        if (_service == 'sm') return 'http://localhost:10003';
        if (_service == 'dm') return 'http://localhost:10709';
        if (_service == 'user') return 'http://localhost:10004';
        if (_service == 'gw') return 'http://localhost:9080';
        if (_service == 'sec') return 'http://localhost:10007';
        if (_service == 'pm') return 'http://localhost:10011';
    }
}

if (isK8sEnv() && !DATA_STACK_NAMESPACE) throw new Error('DATA_STACK_NAMESPACE not found. Please check your configMap');


module.exports = {
    imageTag: process.env.IMAGE_TAG,
    hostname: process.env.HOSTNAME,
    release: process.env.RELEASE,
    port: process.env.PORT || 10011,
    httpsPort: process.env.HTTPS_PORT || 10443,
    baseUrlSM: get('sm') + '/sm',
    baseUrlNE: get('ne') + '/ne',
    baseUrlUSR: get('user') + '/rbac',
    baseUrlPM: get('pm') + '/pm',
    baseUrlSEC: get('sec') + '/sec',
    baseUrlDM: get('dm') + '/dm',
    maxHeapSize: process.env.NODE_MAX_HEAP_SIZE || '4096',
    isK8sEnv: isK8sEnv,
    logQueueName: 'systemService',
    DATA_STACK_NAMESPACE,
    mongoUrl: process.env.MONGO_APPCENTER_URL || 'mongodb://localhost',
    authorDB: process.env.MONGO_AUTHOR_DBNAME || 'datastackConfig',
    mongoAuthorUrl: process.env.MONGO_AUTHOR_URL || 'mongodb://localhost',
    mongoLogUrl: process.env.MONGO_LOGS_URL || 'mongodb://localhost',
    logsDB: process.env.MONGO_LOGS_DBNAME || 'datastackLogs',
    googleKey: process.env.GOOGLE_API_KEY || '',
    queueName: 'webHooks',
    logQueueName: 'systemService',
    interactionLogQueueName: 'interactionLogs',
    interactionQueueName: 'interaction',
    eventsQueueName: 'events',
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
    verifyDeploymentUser: parseBoolean(process.env.VERIFY_DEPLOYMENT_USER) || false,
    TZ_DEFAULT: process.env.TZ_DEFAULT || 'Zulu',
    B2B_AGENT_MAX_FILE_SIZE: process.env.B2B_AGENT_MAX_FILE_SIZE || '100m',
    B2B_FLOW_REJECT_ZONE_ACTION: process.env.B2B_FLOW_REJECT_ZONE_ACTION || 'queue',
    B2B_FLOW_MAX_CONCURRENT_FILES: parseInt(process.env.B2B_FLOW_MAX_CONCURRENT_FILES || '0'),
    B2B_ENABLE_TIMEBOUND: parseBoolean(process.env.B2B_ENABLE_TIMEBOUND),
    B2B_ENABLE_TRUSTED_IP: parseBoolean(process.env.B2B_ENABLE_TRUSTED_IP),
    VERIFY_DEPLOYMENT_USER: parseBoolean(process.env.VERIFY_DEPLOYMENT_USER),
    secret: process.env.TOKEN_SECRET || 'u?5k167v13w5fhjhuiweuyqi67621gqwdjavnbcvadjhgqyuqagsduyqtw87e187etqiasjdbabnvczmxcnkzn',
    MAX_JSON_SIZE: process.env.MAX_JSON_SIZE || '5mb'
};