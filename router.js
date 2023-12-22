const log4js = require('log4js');
const router = require('express').Router({ mergeParams: true });
const { v4: uuid } = require('uuid');
const proxy = require('express-http-proxy');
const url = require('url');
const httpClient = require('./http-client');

const routerUtils = require('./utils/router.utils');
const flowUtils = require('./utils/flow.utils');
const config = require('./config');

const logger = log4js.getLogger(global.loggerName);
routerUtils.initRouterMap();

router.use('/:app/:api(*)?', async (req, res, next) => {
	try {
		const path = '/' + req.params.app + '/' + req.params.api;
		let routeData = routerUtils.getMatchingRoute(req, path, global.activeFlows);
		logger.debug('Looking for path in map:', path, routeData);
		if (!routeData) {
			return res.status(400).json({ message: `No Flows with path ${path} Found` });
		}
		const headers = JSON.parse(JSON.stringify(req.headers));
		let txnId = uuid().split('-');
		headers['data-stack-txn-id'] = `${txnId[1]}${txnId[2]}`;
		if (!req.header('data-stack-remote-txn-id')) {
			headers['data-stack-remote-txn-id'] = uuid();
		}
		delete headers['cookie'];
		delete headers['host'];
		delete headers['connection'];
		delete headers['user-agent'];
		delete headers['content-length'];
		// const routeData = global.activeFlows[path];
		let proxyHost = routeData.proxyHost;
		if (config.isK8sEnv()) {
			if (!routeData || !routeData.proxyHost || !routeData.proxyPath) {
				return res.status(404).json({ message: 'No Route Found' });
			}
			//Check flow readiness
			let readinessPath = '/api/b2b/internal/health/ready';
			const resp = await httpClient.httpRequest({
				method: 'GET',
				url: proxyHost + readinessPath
			});
			if (resp.statusCode != 200) {
				return res.status(resp.statusCode).json({ message: 'Flow is not running' });
			}
		}

		const remoteTxnIdExists = await flowUtils.checkForUniqueRemoteTxnId(req, { flowId: routeData.flowId });
		if (remoteTxnIdExists) {
			return res.status(400).json({ message: 'Unique Remote Txn ID Check Failed' });
		}

		const result = await flowUtils.createInteraction(req, { flowId: routeData.flowId });
		const interactionId = result.insertedId;
		let proxyPath;
		if (Object.keys(req.query).length > 0) {
			const urlParsed = url.parse(req.url, true);
			logger.trace('URL parsed with query params - ', urlParsed.search);
			proxyPath = '/api/b2b' + path + urlParsed.search + '&interactionId=' + interactionId;
		} else {
			proxyPath = '/api/b2b' + path + '?interactionId=' + interactionId;
		}
		logger.info('Proxying request to: ', proxyHost + proxyPath);
		proxy(proxyHost, {
			memoizeHost: false,
			parseReqBody: false,
			preserveHostHdr: true,
			proxyReqPathResolver: function () {
				return proxyPath;
			}
		})(req, res, next);
		// const resp = await httpClient.httpRequest({
		//     method,
		//     url: proxyPath,
		//     headers: headers,
		//     json: req.body
		// });
		// res.status(resp.statusCode).json(resp.body);
	} catch (err) {
		let statusCode = err.statusCode ? err.statusCode : 500;
		let responseBody;
		if (err.body) {
			responseBody = err.body;
		} else if (err.message) {
			responseBody = { message: err.message };
		} else {
			responseBody = err;
		}
		logger.error(err);
		if (responseBody.toString().includes('ECONNREFUSED')) {
			responseBody = { message: 'Flow is down, please check the flow pod status' };
		}
		res.status(statusCode).json(responseBody);
	}
});


module.exports = router;