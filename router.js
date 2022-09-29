const log4js = require('log4js');
const router = require('express').Router({ mergeParams: true });
const { v4: uuid } = require('uuid');
const proxy = require('express-http-proxy');

const routerUtils = require('./utils/router.utils');
const flowUtils = require('./utils/flow.utils');

const logger = log4js.getLogger(global.loggerName);
routerUtils.initRouterMap();

router.use('/:app/:api', async (req, res) => {
    try {
        const path = '/' + req.params.app + '/' + req.params.api;
        logger.debug('Looking for path in map:', path, global.activeFlows[path]);
        if (!global.activeFlows[path]) {
            return res.status(400).json({ message: `No Flows with path ${path} Found` });
        }
        const headers = JSON.parse(JSON.stringify(req.headers));
        headers['data-stack-txn-id'] = uuid();
        if (!req.header('data-stack-remote-txn-id')) {
            headers['data-stack-remote-txn-id'] = uuid();
        }
        delete headers['cookie'];
        delete headers['host'];
        delete headers['connection'];
        delete headers['user-agent'];
        delete headers['content-length'];
        const routeData = global.activeFlows[path];
        const proxyHost = routeData.proxyHost;
        const proxyPath = routeData.proxyPath;
        // const proxyPath = '/api/b2b' + path;
        flowUtils.createInteraction(req, { flowId: routeData.flowId });
        logger.info('Proxying request to: ', proxyHost + proxyPath);
        proxy(proxyHost, {
            memoizeHost: false,
            parseReqBody: false,
            preserveHostHdr: true,
            proxyReqPathResolver: function (req) {
                return proxyPath;
            }
        })(req, res);
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
        res.status(statusCode).json(responseBody);
    }
});


module.exports = router;