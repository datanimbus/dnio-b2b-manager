const log4js = require('log4js');
const router = require('express').Router();
const { v4: uuid } = require('uuid');

const httpClient = require('./http-client');
const routerUtils = require('./utils/router.utils');

const logger = log4js.getLogger(global.loggerName);
routerUtils.initRouterMap();

router.use(async (req, res) => {
    try {
        const path = req.path;
        const method = req.method;
        if (!global.activeFlows[path]) {
            return res.status(400).json({ message: `No Flows with path ${path} Found` });
        }
        const headers = req.headers;
        headers['data-stack-txn-id'] = uuid();
        if (!req.header('data-stack-remote-txn-id')) {
            headers['data-stack-remote-txn-id'] = uuid();
        }
        const proxyPath = global.activeFlows[path] + '/api/b2b' + path;
        logger.info('Proxying request to: ', proxyPath);
        const resp = await httpClient.httpRequest({
            method,
            url: proxyPath,
            headers: headers,
            json: req.body
        });
        res.status(resp.statusCode).json(resp.body);
    } catch (err) {
        logger.error(err);
        res.status(500).json({ message: err.message });
    }
});


module.exports = router;