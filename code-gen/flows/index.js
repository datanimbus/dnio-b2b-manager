const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const copy = require('recursive-copy');

const config = require('../../config/config')
const schemaUtils = require('@appveen/utils').schemaUtils;
const { getRequestContent } = require('./generators/request.generator');
const { getSuccessContent } = require('./generators/success.generator');
const { getErrorContent } = require('./generators/error.generator');
const fileUtilsGenerator = require('./generators/file.utils');

const logger = global.logger;

async function createProject(flowJSON) {
  try {
    if (!flowJSON.port) {
      flowJSON.port = 31000;
    }
    const folderPath = path.join(process.cwd(), 'generatedFlows', flowJSON.flowID);
    logger.info('Creating Project Folder:', folderPath);

    mkdirp.sync(folderPath);
    mkdirp.sync(path.join(folderPath, 'schemas'));
    if (fs.existsSync(path.join(folderPath, 'routes'))) {
      fs.rmdirSync(path.join(folderPath, 'routes'), { recursive: true });
    }
    if (fs.existsSync(path.join(folderPath, 'utils'))) {
      fs.rmdirSync(path.join(folderPath, 'utils'), { recursive: true });
    }
    mkdirp.sync(path.join(folderPath, 'routes'));
    mkdirp.sync(path.join(folderPath, 'utils'));

    Object.keys(flowJSON.structures).forEach(key => {
      const structure = flowJSON.structures[key].structure;
      fs.writeFileSync(path.join(folderPath, 'schemas', `${key}.schema.json`), JSON.stringify(schemaUtils.convertToJSONSchema(structure)));
    });
    if (!config.isK8sEnv()) {
      let baseImagePath;
      if (process.cwd().indexOf('ds-flows') > -1) {
        baseImagePath = path.join(process.cwd());
      } else {
        baseImagePath = path.join(process.cwd(), '../ds-b2b-flow');
      }
      fs.copyFileSync(path.join(baseImagePath, 'package.json'), path.join(folderPath, 'package.json'));
      fs.copyFileSync(path.join(baseImagePath, 'package-lock.json'), path.join(folderPath, 'package-lock.json'));
      fs.copyFileSync(path.join(baseImagePath, 'flow.yaml'), path.join(folderPath, 'flow.yaml'));
      fs.copyFileSync(path.join(baseImagePath, 'config.js'), path.join(folderPath, 'config.js'));
      fs.copyFileSync(path.join(baseImagePath, 'app.js'), path.join(folderPath, 'app.js'));
      // fs.copyFileSync(path.join(baseImagePath, 'utils', 'flow.utils.js'), path.join(folderPath, 'utils', 'flow.utils.js'),);
      const cpUtils = await copy(path.join(baseImagePath, 'utils'), path.join(folderPath, 'utils'));
      logger.info('Copied utils', cpUtils ? cpUtils.length : 0);
      const cpRoutes = await copy(path.join(baseImagePath, 'routes'), path.join(folderPath, 'routes'));
      logger.info('Copied routes', cpRoutes ? cpRoutes.length : 0);
    }

    let { content: requestContent } = await getRequestContent(flowJSON);
    let { content: successContent } = await getSuccessContent(flowJSON);
    let { content: errorContent } = await getErrorContent(flowJSON);
    fs.writeFileSync(path.join(folderPath, 'routes', `request.router.js`), requestContent);
    fs.writeFileSync(path.join(folderPath, 'routes', `success.router.js`), successContent);
    fs.writeFileSync(path.join(folderPath, 'routes', `error.router.js`), errorContent);
    fs.writeFileSync(path.join(folderPath, 'utils', `file.utils.js`), fileUtilsGenerator.getContent(flowJSON));
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
  let base = `${dockerReg}data.stack:b2b.base.${process.env.IMAGE_TAG}`;
  if (dockerRegistryType == 'ECR') base = `${dockerReg}:data.stack.b2b.base.${process.env.IMAGE_TAG}`;
  logger.debug(`Base image :: ${base}`);
  return `
    FROM ${base}

    WORKDIR /app

    COPY . .

    ENV NODE_ENV="production"
    ENV DATA_STACK_NAMESPACE="${config.dataStackNS}"
    ENV DATA_STACK_APP="${flowData.appName}"
    ENV DATA_STACK_PARTNER_ID="${flowData.partnerID}"
    ENV DATA_STACK_PARTNER_NAME="${flowData.partnerName}"
    ENV DATA_STACK_FLOW_NAMESPACE="${flowData.namespace}"
    ENV DATA_STACK_FLOW_ID="${flowData.flowID}"
    ENV DATA_STACK_FLOW_NAME="${flowData.flowName}"
    ENV DATA_STACK_FLOW_VERSION="${flowData.flowVersion}"
    ENV DATA_STACK_FLOW_DIRECTION="${flowData.direction}"
    ENV DATA_STACK_DEPLOYMENT_NAME="${flowData.deploymentName}"
    ENV RELEASE="${release}"
    ENV PORT="${port}"
    ENV DATA_DB="${config.dataStackNS}-${flowData.appName}"

    EXPOSE ${port}

    CMD [ "node", "app.js" ]
  `
}


function getEnvFile(release, port, flowData) {
  return `
    DATA_STACK_NAMESPACE="${config.dataStackNS}"
    DATA_STACK_APP="${flowData.appName}"
    DATA_STACK_PARTNER_ID="${flowData.partnerID}"
    DATA_STACK_PARTNER_NAME="${flowData.partnerName}"
    DATA_STACK_FLOW_NAMESPACE="${flowData.namespace}"
    DATA_STACK_FLOW_ID="${flowData.flowID}"
    DATA_STACK_FLOW_NAME="${flowData.flowName}"
    DATA_STACK_FLOW_VERSION="${flowData.flowVersion}"
    DATA_STACK_FLOW_DIRECTION="${flowData.direction}"
    DATA_STACK_DEPLOYMENT_NAME="${flowData.deploymentName}"
    RELEASE="${release}"
    PORT="${port}"
    DATA_DB="${config.dataStackNS}-${flowData.appName}"
    LOG_LEVEL="debug"
  `
}


module.exports.createProject = createProject;
