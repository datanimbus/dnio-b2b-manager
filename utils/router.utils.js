const log4js = require('log4js');
const mongoose = require('mongoose');

const logger = log4js.getLogger(global.loggerName);
const flowModal = mongoose.model('flow');

async function initRouterMap() {
	try {
		const flows = await flowModal.find({}).lean();
		global.activeFlows = {};
		flows.forEach(item => {
			global.activeFlows['/' + item.app + item.inputStage.options.path] = `http://${item.deploymentName}.${item.namespace}`;
		});
		logger.trace(global.activeFlows);
	} catch (err) {
		logger.error(err);
	}
}



module.exports.initRouterMap = initRouterMap;