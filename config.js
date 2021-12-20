
const dataStackUtils = require('@appveen/data.stack-utils');
const logger = global.logger;
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
        if (_service == 'pm') return `http://pm.${DATA_STACK_NAMESPACE}`;
        if (_service == 'user') return `http://user.${DATA_STACK_NAMESPACE}`;
        if (_service == 'gw') return `http://gw.${DATA_STACK_NAMESPACE}`;
        if (_service == 'sec') return `http://sec.${DATA_STACK_NAMESPACE}`;
        if (_service == 'pm') return `http://pm.${DATA_STACK_NAMESPACE}`;
    } else {
        if (_service == 'ne') return 'http://localhost:10010';
        if (_service == 'sm') return 'http://localhost:10003';
        if (_service == 'pm') return 'http://localhost:10011';
        if (_service == 'user') return 'http://localhost:10004';
        if (_service == 'gw') return 'http://localhost:9080';
        if (_service == 'sec') return 'http://localhost:10007';
        if (_service == 'pm') return 'http://localhost:10011';
    }
}

let allowedFileExtArr = ['ppt', 'xls', 'csv', 'doc', 'jpg', 'png', 'apng', 'gif', 'webp', 'flif', 'cr2', 'orf', 'arw', 'dng', 'nef', 'rw2', 'raf', 'tif', 'bmp', 'jxr', 'psd', 'zip', 'tar', 'rar', 'gz', 'bz2', '7z', 'dmg', 'mp4', 'mid', 'mkv', 'webm', 'mov', 'avi', 'mpg', 'mp2', 'mp3', 'm4a', 'oga', 'ogg', 'ogv', 'opus', 'flac', 'wav', 'spx', 'amr', 'pdf', 'epub', 'exe', 'swf', 'rtf', 'wasm', 'woff', 'woff2', 'eot', 'ttf', 'otf', 'ico', 'flv', 'ps', 'xz', 'sqlite', 'nes', 'crx', 'xpi', 'cab', 'deb', 'ar', 'rpm', 'Z', 'lz', 'msi', 'mxf', 'mts', 'blend', 'bpg', 'docx', 'pptx', 'xlsx', '3gp', '3g2', 'jp2', 'jpm', 'jpx', 'mj2', 'aif', 'qcp', 'odt', 'ods', 'odp', 'xml', 'mobi', 'heic', 'cur', 'ktx', 'ape', 'wv', 'wmv', 'wma', 'dcm', 'ics', 'glb', 'pcap', 'dsf', 'lnk', 'alias', 'voc', 'ac3', 'm4v', 'm4p', 'm4b', 'f4v', 'f4p', 'f4b', 'f4a', 'mie', 'asf', 'ogm', 'ogx', 'mpc'];
let DATA_STACK_ALLOWED_FILE_TYPE = process.env.DATA_STACK_ALLOWED_FILE_TYPE ? process.env.DATA_STACK_ALLOWED_FILE_TYPE.split(',') : allowedFileExtArr;

if (isK8sEnv() && !DATA_STACK_NAMESPACE) throw new Error('DATA_STACK_NAMESPACE not found. Please check your configMap');


module.exports = {
    port: process.env.PORT || 8080,
    httpsPort: process.env.HTTPS_PORT || 8443,
    baseUrlSM: get('sm') + '/sm',
    baseUrlNE: get('ne') + '/ne',
    baseUrlUSR: get('user') + '/rbac',
    baseUrlPM: get('pm') + '/pm',
    baseUrlSEC: get('sec') + '/sec',
    isK8sEnv: isK8sEnv,
    logQueueName: 'systemService',
    DATA_STACK_NAMESPACE,
    mongoUrlAppcenter: process.env.MONGO_APPCENTER_URL || 'mongodb://localhost',
    streamingConfig: {
        url: process.env.STREAMING_HOST || 'nats://127.0.0.1:4222',
        user: process.env.STREAMING_USER || '',
        pass: process.env.STREAMING_PASS || '',
        maxReconnectAttempts: process.env.STREAMING_RECONN_ATTEMPTS || 500,
        connectTimeout: 2000,
        stanMaxPingOut: process.env.STREAMING_RECONN_TIMEWAIT_MILLI || 500
    },
    mongoOptions: {
        reconnectTries: process.env.MONGO_RECONN_TRIES,
        reconnectInterval: process.env.MONGO_RECONN_TIME_MILLI,
        useNewUrlParser: true,
        dbName: process.env.MONGO_AUTHOR_DBNAME || 'datastackConfig'
    },
    mongoAppcenterOptions: {
        reconnectTries: process.env.MONGO_RECONN_TRIES,
        reconnectInterval: process.env.MONGO_RECONN_TIME_MILLI,
        useNewUrlParser: true
    },
    TZ_DEFAULT: process.env.TZ_DEFAULT || 'Zulu',
    DISABLE_INSIGHTS: process.env.DISABLE_INSIGHTS ? parseBoolean(process.env.DISABLE_INSIGHTS) : false,
    RBAC_USER_AUTH_MODES: process.env.RBAC_USER_AUTH_MODES ? (process.env.RBAC_USER_AUTH_MODES).split(',') : ['local'],
    RBAC_USER_TOKEN_DURATION: parseInt(process.env.RBAC_USER_TOKEN_DURATION || 600),
    RBAC_USER_TOKEN_REFRESH: process.env.RBAC_USER_TOKEN_REFRESH ? parseBoolean(process.env.RBAC_USER_TOKEN_REFRESH) : true,
    RBAC_USER_TO_SINGLE_SESSION: parseBoolean(process.env.RBAC_USER_TO_SINGLE_SESSION || false),
    RBAC_USER_CLOSE_WINDOW_TO_LOGOUT: parseBoolean(process.env.RBAC_USER_CLOSE_WINDOW_TO_LOGOUT || false),
    RBAC_BOT_TOKEN_DURATION: parseInt(process.env.RBAC_BOT_TOKEN_DURATION || 1800),
    RBAC_HB_INTERVAL: parseInt(process.env.RBAC_HB_INTERVAL || 50),
    RBAC_USER_RELOGIN_ACTION: process.env.RBAC_USER_RELOGIN_ACTION ? process.env.RBAC_USER_RELOGIN_ACTION.toLowerCase() : 'allow',
    PRIVATE_FILTER: process.env.SAVE_FILTER_DEFAULT_MODE_PRIVATE ? parseBoolean(process.env.SAVE_FILTER_DEFAULT_MODE_PRIVATE) : true,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || '',
    DS_FUZZY_SEARCH: parseBoolean(process.env.DS_FUZZY_SEARCH || false),
    B2B_AGENT_MAX_FILE_SIZE: process.env.B2B_AGENT_MAX_FILE_SIZE || '100m',
    B2B_FLOW_REJECT_ZONE_ACTION: process.env.B2B_FLOW_REJECT_ZONE_ACTION || 'queue',
    B2B_FLOW_MAX_CONCURRENT_FILES: parseInt(process.env.B2B_FLOW_MAX_CONCURRENT_FILES || '0'),
    B2B_ENABLE_TIMEBOUND: parseBoolean(process.env.B2B_ENABLE_TIMEBOUND),
    B2B_ENABLE_TRUSTED_IP: parseBoolean(process.env.B2B_ENABLE_TRUSTED_IP),
    VERIFY_DEPLOYMENT_USER: parseBoolean(process.env.VERIFY_DEPLOYMENT_USER),
    B2B_ENABLE: parseBoolean(process.env.B2B_ENABLE),
    EXPERIMENTAL_FEATURES: parseBoolean(process.env.EXPERIMENTAL_FEATURES),
    DATA_STACK_ALLOWED_FILE_TYPE,
    RBAC_PASSWORD_LENGTH: parseInt(process.env.RBAC_PASSWORD_LENGTH || 8),
    RBAC_PASSWORD_COMPLEXITY: parseBoolean(process.env.RBAC_PASSWORD_COMPLEXITY || true),
    RBAC_USER_LOGIN_FAILURE_THRESHOLD: parseInt(process.env.RBAC_USER_LOGIN_FAILURE_THRESHOLD || 5),
    RBAC_USER_LOGIN_FAILURE_DURATION: parseInt(process.env.RBAC_USER_LOGIN_FAILURE_DURATION || 600),
    RBAC_USER_LOGIN_FAILURE_COOLDOWN: parseInt(process.env.RBAC_USER_LOGIN_FAILURE_COOLDOWN || 300),
    TOKEN_SECRET: process.env.TOKEN_SECRET || 'u?5k167v13w5fhjhuiweuyqi67621gqwdjavnbcvadjhgqyuqagsduyqtw87e187etqiasjdbabnvczmxcnkzn',
    MAX_JSON_SIZE: process.env.MAX_JSON_SIZE || '5mb'
};