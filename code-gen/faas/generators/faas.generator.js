const log4js = require('log4js');
const logger = log4js.getLogger('request.generator');


async function getFaasContent(functionData) {

	let content = `
		const lodash = require('lodash');
		const log4js = require('log4js');
		const faker = require("faker");
		const uuid = require('uuid');
		const validator = require('validator');
		const moment = require('moment');
		const got = require('got');
		const SDK = require('@appveen/ds-sdk');
		const router = require('express').Router();
		
		const customAppender = require('../utils/appender.utils.js');

		
		if (process.env.NODE_ENV != 'production') {
			require('dotenv').config();
		}

		const { fqdn, logLevel, dataStackNS, dataStackAppName, dataStackAllowedFileType } = require('../config');
		const faasData = require('../faas.json');

		const FQDN = fqdn;
		const LOG_LEVEL = logLevel;
		const DATA_STACK_NAMESPACE = dataStackNS;
		const DATA_STACK_APP_NAMESPACE = dataStackAppName;
		const DATA_STACK_ALLOWED_FILE_TYPE = dataStackAllowedFileType;

		process.env = {
			FQDN,
			LOG_LEVEL,
			DATA_STACK_NAMESPACE,
			DATA_STACK_APP_NAMESPACE,
			DATA_STACK_ALLOWED_FILE_TYPE
		};

		log4js.configure({
			appenders: {
				out: { type: 'stdout' },
				custom: {
					type: customAppender
				}
			},
			categories: {
				default: { appenders: ['out'], level: LOG_LEVEL },
				console: { appenders: ['custom'], level: LOG_LEVEL },
			}
		});

		let logger = log4js.getLogger('console')
		let globalLogger = global.logger;

		logger.addContext('faasId', '${functionData._id}');
		logger.addContext('app', '${functionData.app}');

  		router.use(async (req, res, next) => {
			logger.info(\`[\${req.method}] \${req.path}\`);
			globalLogger.info(\`Starting to Process Faas -> Txn-Id - \${req.header('txnId')} \`);

			// Deny new requests, if process kill request was recieved
			if (global.stopServer) {
				return res.status(400).json({ message: 'Server has stopped accepting requests' });
			}

			if (Buffer.isBuffer(req.body)) {
				req.body = req.body.toString();
			}
			next();
		});

		${functionData.code}
		
		module.exports = router;
	`;
	return { content };
}


module.exports = {
	getFaasContent
};
