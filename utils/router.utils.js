const log4js = require('log4js');
const mongoose = require('mongoose');

const config = require('../config');

const logger = log4js.getLogger(global.loggerName);
const flowModal = mongoose.model('flow');

async function initRouterMap() {
	try {
		const flows = await flowModal.find({}).lean();
		global.activeFlows = {};
		flows.forEach(item => {
			if (config.isK8sEnv()) {
				global.activeFlows['/' + item.app + item.inputNode.options.path] = {
					proxyHost: `http://${item.deploymentName}.${item.namespace}`,
					proxyPath: '/api/b2b/' + item.app + item.inputNode.options.path,
					flowId: item._id
				};
			} else {
				global.activeFlows['/' + item.app + item.inputNode.options.path] = {
					proxyHost: `http://localhost:8000`,
					proxyPath: '/api/b2b/' + item.app + item.inputNode.options.path,
					flowId: item._id
				};
			}
		});
		logger.trace(global.activeFlows);
	} catch (err) {
		logger.error(err);
	}
}



module.exports.initRouterMap = initRouterMap;