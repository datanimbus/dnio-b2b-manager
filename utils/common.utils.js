const log4js = require('log4js');
const _ = require('lodash');

const config = require('../config');
const httpClient = require('../http-client');

const logger = log4js.getLogger(global.loggerName);

const validatePropertyTypes = ['String', 'Number', 'Boolean', 'Date', 'Object', 'Array'];

async function getApp(req, app) {
	try {
		const res = await httpClient.httpRequest({
			url: config.baseUrlUSR + '/app/' + app + '?select=_id',
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'TxnId': req.headers['TxnId'],
				'Authorization': req.headers['Authorization']
			}
		});
		return res;
	} catch (err) {
		logger.error(err);
		return { statusCode: 500, body: err };
	}
}

function countAttr(def) {
	let count = 0;
	if (def && Array.isArray(def)) {
		def.forEach(_d => {
			if (_d && _d.type === 'Object') {
				count += countAttr(_d.definition);
			} else {
				count++;
			}
		});
		return count;
	} else {
		return count;
	}
}

function validateDefinition(fields) {
	const errors = {};
	if (fields) {
		fields.forEach((def, i) => {
			if (!def.type) {
				errors[i] = 'Type not set';
			} else if (!def.key) {
				errors[i] = 'Key not set';
			} else if (validatePropertyTypes.indexOf(def.type) == -1) {
				errors[i] = 'Not Valid Type';
			} else if (def.key != '_self' && !def.properties.name) {
				errors[i] = 'Label not set';
			} else if (def.type === 'Object' || def.type == 'Array') {
				let tempErrors = validateDefinition(def.definition);
				if (!_.isEmpty(tempErrors)) {
					errors[i] = tempErrors;
				}
			}
		});
	}
	if (!_.isEmpty(errors)) {
		return errors;
	}
	return null;
}

module.exports.getApp = getApp;
module.exports.countAttr = countAttr;
module.exports.validateDefinition = validateDefinition;