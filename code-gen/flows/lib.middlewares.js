const log4js = require('log4js');
const { v4: uuid } = require('uuid');

const logger = log4js.getLogger(global.loggerName);

let e = {};

e.addHeaders = (_req, _res, _next) => {
	if(!_req.headers['data-stack-txn-id']) {
		_req.headers['data-stack-txn-id'] = uuid();
		logger.info(`No txn id found. Setting txn id to : ${_req.headers['data-stack-txn-id']}`);
	}
	if(!_req.headers['data-stack-remote-txn-id']) {
		_req.headers['data-stack-remote-txn-id'] = `${uuid()}`;
		logger.info(`No remote txn id found. Setting remote txn id to : ${_req.headers['data-stack-remote-txn-id']}`);
	}
	_next();
};


module.exports = e;