'use strict';
const fs = require('fs');

const dataStackNS = process.env.DATA_STACK_NAMESPACE;

function isK8sEnv() {
  return process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT;
}

if (isK8sEnv() && !dataStackNS) throw new Error('DATA_STACK_NAMESPACE not found. Please check your configMap');

function isDockerEnv() {
  return fs.existsSync('/.dockerenv');
}

function getHostOSBasedLocation() {
  if (process.env.PLATFORM == 'NIX') return 'localhost';
  return 'host.docker.internal';
}

function get(_service) {
  if (isK8sEnv()) {
    return `http://${_service}.${dataStackNS}`;
  } else if (isDockerEnv()) {
    if (_service == 'dm') return 'http://' + getHostOSBasedLocation() + ':10709';
    if (_service == 'ne') return 'http://' + getHostOSBasedLocation() + ':10010';
    if (_service == 'sm') return 'http://' + getHostOSBasedLocation() + ':10003';
    if (_service == 'pm') return 'http://' + getHostOSBasedLocation() + ':10011';
    if (_service == 'user') return 'http://' + getHostOSBasedLocation() + ':10004';
    if (_service == 'gw') return 'http://' + getHostOSBasedLocation() + ':9080';
    if (_service == 'wf') return 'http://' + getHostOSBasedLocation() + ':10006';
    if (_service == 'sec') return 'http://' + getHostOSBasedLocation() + ':10007';
    if (_service == 'mon') return 'http://' + getHostOSBasedLocation() + ':10005';
    if (_service == 'gw') return 'http://' + getHostOSBasedLocation() + ':9080';
  } else {
    if (_service == 'b2bgw') return 'http://localhost:8080';
    if (_service == 'dm') return 'http://localhost:10709';
    if (_service == 'ne') return 'http://localhost:10010';
    if (_service == 'sm') return 'http://localhost:10003';
    if (_service == 'pm') return 'http://localhost:10011';
    if (_service == 'user') return 'http://localhost:10004';
    if (_service == 'gw') return 'http://localhost:9080';
    if (_service == 'wf') return 'http://localhost:10006';
    if (_service == 'sec') return 'http://localhost:10007';
    if (_service == 'mon') return 'http://localhost:10005';
    if (_service == 'gw') return 'http://localhost:9080';
  }
}


const logger = global.logger;
const temp = {
  baseUrlB2BGW: get('b2bgw'),
  baseUrlSM: get('sm') + '/sm',
  baseUrlNE: get('ne') + '/ne',
  baseUrlUSR: get('user') + '/rbac',
  baseUrlMON: get('mon') + '/mon',
  baseUrlWF: get('wf') + '/workflow',
  baseUrlSEC: get('sec') + '/sec',
  baseUrlDM: get('dm') + '/dm',
  baseUrlPM: get('pm') + '/pm',
  baseUrlGW: get('gw'),
  isK8sEnv: isK8sEnv,
  isDockerEnv: isDockerEnv,
  logLevel: process.env.LOG_LEVEL,
  fqdn: process.env.FQDN,
  dataStackAllowedFileType: process.env.DATA_STACK_ALLOWED_FILE_TYPE,
  dataStackNS: process.env.DATA_STACK_NAMESPACE,
  dataStackAppName: process.env.DATA_STACK_APP,
  dataStackPartnerId: process.env.DATA_STACK_PARTNER_ID,
  dataStackPartnerName: process.env.DATA_STACK_PARTNER_NAME,
  dataStackFaasId: process.env.DATA_STACK_FAAS_ID,
  dataStackFaasVersion: process.env.DATA_STACK_FAAS_VERSION,
  dataStackFaasName: process.env.DATA_STACK_FAAS_NAME,
  dataStackDeploymentName: process.env.DATA_STACK_DEPLOYMENT_NAME,
  release: process.env.RELEASE,
  port: process.env.PORT || '31000',
	logQueueName: 'systemService',
  consoleLogQueueName: 'faasConsoleLogs',
  faasLastInvokedQueue: 'faasLastInvoked',
  NATSConfig: {
    url: process.env.STREAMING_HOST || 'nats://127.0.0.1:4222',
    user: process.env.STREAMING_USER || '',
    pass: process.env.STREAMING_PASS || '',
    maxReconnectAttempts: process.env.STREAMING_RECONN_ATTEMPTS || 500,
    reconnectTimeWait: process.env.STREAMING_RECONN_TIMEWAIT_MILLI || 500,
  },
  mongoAppcenterUrl: process.env.MONGO_APPCENTER_URL || 'mongodb://localhost:27017',
  mongoAuthorUrl: process.env.MONGO_AUTHOR_URL || 'mongodb://localhost:27017',
  mongoLogsUrl: process.env.MONGO_LOGS_URL || 'mongodb://localhost:27017',
  dataDB: process.env.DATA_DB,
  configDB: process.env.MONGO_AUTHOR_DBNAME || 'datastackConfig',
  logsDB: process.env.MONGO_LOGS_DBNAME || 'datastackLogs',
  mongoAuthorOptions: {
    reconnectTries: process.env.MONGO_RECONN_TRIES,
    reconnectInterval: process.env.MONGO_RECONN_TIME_MILLI,
    dbName: process.env.MONGO_AUTHOR_DBNAME || 'datastackConfig',
    useNewUrlParser: true
  },
  mongoAppcenterOptions: {
    numberOfRetries: process.env.MONGO_RECONN_TRIES,
    retryMiliSeconds: process.env.MONGO_RECONN_TIME_MILLI,
    useNewUrlParser: true
  },
  mongoLogsOptions: {
    numberOfRetries: process.env.MONGO_RECONN_TRIES,
    retryMiliSeconds: process.env.MONGO_RECONN_TIME_MILLI,
    dbName: process.env.MONGO_LOGS_DBNAME || 'datastackLogs',
    useNewUrlParser: true
  },
  maxHeapSize: process.env.NODE_MAX_HEAP_SIZE || '4096',
  healthTimeout: process.env.K8S_DS_HEALTH_API_TIMEOUT ? parseInt(process.env.K8S_DS_HEALTH_API_TIMEOUT) : 60,
  imageTag: process.env.IMAGE_TAG || process.env.RELEASE || 'dev'

};
//logger.debug(JSON.stringify(temp, null, 2));


module.exports = temp;
