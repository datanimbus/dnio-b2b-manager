const log4js = require('log4js');
const mongoose = require('mongoose');

const config = require('../config');

const logger = log4js.getLogger(global.loggerName);
const flowModal = mongoose.model('flow');

async function initRouterMap() {
	try {
		const flows = await flowModal.find({ status: 'Active' }).lean();
		global.activeFlows = {};
		flows.forEach(item => {
			if (config.isK8sEnv()) {
				global.activeFlows['/' + item.app + item.inputNode.options.path] = {
					proxyHost: `http://${item.deploymentName}.${item.namespace}`,
					proxyPath: '/api/b2b/' + item.app + item.inputNode.options.path,
					flowId: item._id,
					skipAuth: item.skipAuth || false
				};
			} else {
				global.activeFlows['/' + item.app + item.inputNode.options.path] = {
					proxyHost: 'http://localhost:8000',
					proxyPath: '/api/b2b/' + item.app + item.inputNode.options.path,
					flowId: item._id,
					skipAuth: item.skipAuth || false
				};
			}
		});
		logger.trace(global.activeFlows);
	} catch (err) {
		logger.error(err);
	}
}


function getMatchingRoute(req, path, routeMap) {
	if (!routeMap) {
		return null;
	}
	let tempRoute = null;
	let keys = Object.keys(routeMap);
	for (let index = 0; index < keys.length; index++) {
		const key = keys[index];
		if (compareURL(key, path)) {
			tempRoute = routeMap[key];
			break;
		}
	}
	return tempRoute;
}


function compareURL(tempUrl, url) {
	let tempUrlSegment = tempUrl.split('/').filter(_d => _d != '');
	let urlSegment = url.split('/').filter(_d => _d != '');
	if (tempUrlSegment.length != urlSegment.length) return false;

	let flag = tempUrlSegment.every((_k, i) => {
		if (_k.startsWith('{') && _k.endsWith('}') && urlSegment[i] != '') return true;
		return _k === urlSegment[i];
	});
	logger.trace(`Compare URL for Routing Request :: ${tempUrl}, ${url} :: ${flag}`);
	return flag;
}


module.exports.initRouterMap = initRouterMap;
module.exports.getMatchingRoute = getMatchingRoute;