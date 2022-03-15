const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const log4js = require('log4js');
const copy = require('recursive-copy');

const config = require('../../config')
// const schemaUtils = require('@appveen/utils').schemaUtils;
const codeGen = require('./generators/code.generator');
// const fileUtilsGenerator = require('./generators/file.utils');

const logger = log4js.getLogger(global.loggerName);

async function createProject(flowJSON) {
  try {
    if (!flowJSON.port) {
      flowJSON.port = 31000;
    }
    const folderPath = path.join(process.cwd(), 'generatedFlows', flowJSON._id);
    logger.info('Creating Project Folder:', folderPath);

    mkdirp.sync(folderPath);

    await copy(__dirname, folderPath);

    fs.rmdirSync(path.join(folderPath, `test`), { recursive: true });
    fs.rmdirSync(path.join(folderPath, `generators`), { recursive: true });
    fs.rmSync(path.join(folderPath, `index.js`));

    fs.writeFileSync(path.join(folderPath, `route.js`), codeGen.parseFlow(flowJSON));
    fs.writeFileSync(path.join(folderPath, `stage.utils.js`), codeGen.parseStages(flowJSON));
    fs.writeFileSync(path.join(folderPath, 'Dockerfile'), getDockerFile(config.imageTag, flowJSON.port, flowJSON));
    fs.writeFileSync(path.join(folderPath, 'flow.json'), JSON.stringify(flowJSON));
    fs.writeFileSync(path.join(folderPath, '.env'), getEnvFile(config.release, flowJSON.port, flowJSON));

    logger.info('Project Folder Created!');
  } catch (e) {
    logger.error('Project Folder Error!', e);
  }
}

let dockerRegistryType = process.env.DOCKER_REGISTRY_TYPE ? process.env.DOCKER_REGISTRY_TYPE : '';
if (dockerRegistryType.length > 0) dockerRegistryType = dockerRegistryType.toUpperCase();

let dockerReg = process.env.DOCKER_REGISTRY_SERVER ? process.env.DOCKER_REGISTRY_SERVER : '';
if (dockerReg.length > 0 && !dockerReg.endsWith('/') && dockerRegistryType != 'ECR') dockerReg += '/';


function getDockerFile(release, port, flowData) {
  let base = `${dockerReg}data.stack.bm:${process.env.IMAGE_TAG}`;
  if (dockerRegistryType == 'ECR') base = `${dockerReg}:data.stack.bm:${process.env.IMAGE_TAG}`;
  logger.debug(`Base image :: ${base}`);
  return `
    FROM ${base}

    WORKDIR /app

    RUN rm -rf *

    COPY . .

    ENV NODE_ENV="production"
    ENV DATA_STACK_NAMESPACE="${config.DATA_STACK_NAMESPACE}"
    ENV DATA_STACK_APP="${flowData.app}"
    ENV DATA_STACK_FLOW_NAMESPACE="${flowData.namespace}"
    ENV DATA_STACK_FLOW_ID="${flowData._id}"
    ENV DATA_STACK_FLOW_NAME="${flowData.name}"
    ENV DATA_STACK_FLOW_VERSION="${flowData.version}"
    ENV DATA_STACK_DEPLOYMENT_NAME="${flowData.deploymentName}"
    ENV RELEASE="${release}"
    ENV PORT="${port}"
    ENV IMAGE_TAG="${flowData._id}:${flowData.version}"
    ENV DATA_DB="${config.DATA_STACK_NAMESPACE}-${flowData.app}"

    EXPOSE ${port}

    CMD [ "node", "app.js" ]
  `
}


function getEnvFile(release, port, flowData) {
  return `
    DATA_STACK_NAMESPACE="${config.DATA_STACK_NAMESPACE}"
    DATA_STACK_APP="${flowData.app}"
    DATA_STACK_FLOW_NAMESPACE="${flowData.namespace}"
    DATA_STACK_FLOW_ID="${flowData._id}"
    DATA_STACK_FLOW_NAME="${flowData.name}"
    DATA_STACK_FLOW_VERSION="${flowData.version}"
    DATA_STACK_DEPLOYMENT_NAME="${flowData.deploymentName}"
    RELEASE="${release}"
    PORT="${port}"
    ENV IMAGE_TAG="${flowData._id}:${flowData.version}"
    DATA_DB="${config.dataStackNS}-${flowData.appName}"
    LOG_LEVEL="debug"
  `
}


module.exports.createProject = createProject;
