const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const copy = require('recursive-copy');
const config = require('../../config')
const log4js = require('log4js');

const { getFaasContent } = require('./generators/faas.generator');
const logger = log4js.getLogger(global.loggerName);


async function createProject(functionJSON, txnId) {
  try {
    if (!functionJSON.port) {
      functionJSON.port = 31000;
    }
    const folderPath = path.join(process.cwd(), 'generatedFaas', functionJSON._id);
    logger.info(`[${txnId}] Creating Project Folder - ${folderPath}`);

    if (fs.existsSync(folderPath)) {
      fs.rmdirSync(folderPath, { recursive: true });
    }

    mkdirp.sync(folderPath);
    mkdirp.sync(path.join(folderPath, 'routes'));
    mkdirp.sync(path.join(folderPath, 'utils'));

    fs.copyFileSync(path.join('./code-gen/faas/config.js'), path.join(folderPath, 'config.js'));
    fs.copyFileSync(path.join('./code-gen/faas/app.js'), path.join(folderPath, 'app.js'));
    const cpUtils = await copy(path.join('./code-gen/faas/utils'), path.join(folderPath, 'utils'));
    logger.info(`[${txnId}] Copied utils - ${cpUtils ? cpUtils.length : 0}`);
    const cpRoutes = await copy(path.join('./code-gen/faas/routes'), path.join(folderPath, 'routes'));
    logger.info(`[${txnId}] Copied routes - ${cpRoutes ? cpRoutes.length : 0}`);

    let { content: faasContent } = await getFaasContent(functionJSON);
    fs.writeFileSync(path.join(folderPath, 'routes', `faas.router.js`), faasContent);
    fs.writeFileSync(path.join(folderPath, 'Dockerfile'), getDockerFile(config.imageTag, functionJSON.port, functionJSON));
    fs.writeFileSync(path.join(folderPath, 'faas.json'), JSON.stringify(functionJSON));
    fs.writeFileSync(path.join(folderPath, '.env'), getEnvFile(config.release, functionJSON.port, functionJSON));

    logger.info(`[${txnId}] Project Folder Created! ${folderPath}`);
  } catch (e) {
    logger.error(`[${txnId}] Project Folder Error! ${e}`);
  }
}


let dockerRegistryType = process.env.DOCKER_REGISTRY_TYPE ? process.env.DOCKER_REGISTRY_TYPE : '';
if (dockerRegistryType.length > 0) dockerRegistryType = dockerRegistryType.toUpperCase();


let dockerReg = process.env.DOCKER_REGISTRY_SERVER ? process.env.DOCKER_REGISTRY_SERVER : '';
if (dockerReg.length > 0 && !dockerReg.endsWith('/') && dockerRegistryType != 'ECR') dockerReg += '/';


function getDockerFile(release, port, functionData) {
  let base = `${dockerReg}data.stack.bm:${process.env.IMAGE_TAG}`;
  if (dockerRegistryType == 'ECR') base = `${dockerReg}:data.stack.bm:${process.env.IMAGE_TAG}`;
  logger.debug(`Base image :: ${base}`);
  return `
    FROM ${base}

    WORKDIR /app

    RUN rm -rf *

    COPY . .

    ENV NODE_ENV="production"
    ENV DATA_STACK_NAMESPACE="${config.dataStackNS}"
    ENV DATA_STACK_APP="${functionData.app}"
    ENV DATA_STACK_PARTNER_ID="${functionData.partnerID}"
    ENV DATA_STACK_PARTNER_NAME="${functionData.partnerName}"
    ENV DATA_STACK_FAAS_NAMESPACE="${functionData.namespace}"
    ENV DATA_STACK_FAAS_ID="${functionData._id}"
    ENV DATA_STACK_FAAS_NAME="${functionData.name}"
    ENV DATA_STACK_FAAS_VERSION="${functionData.version}"
    ENV DATA_STACK_DEPLOYMENT_NAME="${functionData.deploymentName}"
    ENV RELEASE="${release}"
    ENV PORT="${port}"
    ENV DATA_DB="${config.dataStackNS}-${functionData.app}"
    ENV STREAMING_HOST="${config.streamingConfig.url}"
    ENV STREAMING_USER="${config.streamingConfig.user}"
    ENV STREAMING_PASS="${config.streamingConfig.pass}"
    ENV STREAMING_RECONN_ATTEMPTS="${config.streamingConfig.maxReconnectAttempts}"
    ENV STREAMING_RECONN_TIMEWAIT_MILLI="${config.streamingConfig.stanMaxPingOut}"

    EXPOSE ${port}

    CMD [ "node", "app.js" ]
  `
}


function getEnvFile(release, port, functionData) {
  return `
    DATA_STACK_NAMESPACE="${config.dataStackNS}"
    DATA_STACK_APP="${functionData.app}"
    DATA_STACK_PARTNER_ID="${functionData.partnerID}"
    DATA_STACK_PARTNER_NAME="${functionData.partnerName}"
    DATA_STACK_FAAS_NAMESPACE="${functionData.namespace}"
    DATA_STACK_FAAS_ID="${functionData._id}"
    DATA_STACK_FAAS_NAME="${functionData.name}"
    DATA_STACK_FAAS_VERSION="${functionData.version}"
    DATA_STACK_DEPLOYMENT_NAME="${functionData.deploymentName}"
    STREAMING_HOST="${config.streamingConfig.url}"
    STREAMING_USER="${config.streamingConfig.user}"
    STREAMING_PASS="${config.streamingConfig.pass}"
    STREAMING_RECONN_ATTEMPTS="${config.streamingConfig.maxReconnectAttempts}"
    STREAMING_RECONN_TIMEWAIT_MILLI="${config.streamingConfig.stanMaxPingOut}"
    RELEASE="${release}"
    PORT="${port}"
    DATA_DB="${config.dataStackNS}-${functionData.app}"
    LOG_LEVEL="debug"
  `
}


module.exports.createProject = createProject;
