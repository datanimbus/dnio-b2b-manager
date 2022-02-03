const log4js = require('log4js');
const mongoose = require('mongoose');

const config = require('../config');

const logger = log4js.getLogger(global.loggerName);
const flowModal = mongoose.model('flow');

async function initRouterMap() {
    try {
        const flows = await flowModal.find().lean();
        global.activeFlows = {};
        flows.forEach(item => {
            const appNamespace = (config.DATA_STACK_NAMESPACE + '-' + item.app).toLowerCase();
            global.activeFlows[item.api] = `http://${item.deploymentName}.${appNamespace}`;
        });
    } catch (err) {
        logger.error(err);
    }
}



module.exports.initRouterMap = initRouterMap;