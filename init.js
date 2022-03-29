const JWT = require('jsonwebtoken');
const log4js = require('log4js');
const config = require('./config');
const httpClient = require('./http-client');

const logger = log4js.getLogger(global.loggerName);

function init() {
    const token = JWT.sign({ name: "DS_B2B_MANAGER", _id: "admin", isSuperAdmin: true }, config.secret);
    global.BM_TOKEN = token;
}


module.exports.init = init;