const JWT = require('jsonwebtoken');
// const log4js = require('log4js');
const config = require('./config');
// const httpClient = require('./http-client');
const path = require('path');
const mkdirp = require('mkdirp');

// const logger = log4js.getLogger(global.loggerName);

function init() {
	const token = JWT.sign({ name: 'DS_B2B_MANAGER', _id: 'admin', isSuperAdmin: true }, config.RBAC_JWT_KEY);
	global.BM_TOKEN = token;

	const folderPath = process.cwd();
	mkdirp.sync(path.join(folderPath, 'downloads'));
}


module.exports.init = init;