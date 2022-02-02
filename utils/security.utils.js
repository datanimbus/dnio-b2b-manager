const crypto = require('crypto');
const log4js = require('log4js');

const config = require('../config');
const httpClient = require('../http-client');

const logger = log4js.getLogger(global.loggerName);


function encryptText(req, app, data) {
	const options = {
		url: config.baseUrlSEC + `/enc/${app}/encrypt`,
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'TxnId': req.headers['TxnId'],
			'Authorization': req.headers['Authorization']
		},
		body: data,
		json: true
	};
	return httpClient.httpRequest(options).then(res => {
		if (!res) {
			logger.error('Security service down');
			throw new Error('Security service down');
		}
		if (res.statusCode === 200) {
			let encryptValue = res.body.data;
			let obj = {
				value: encryptValue,
				checksum: crypto.createHash('md5').update(data).digest('hex')
			};
			return obj;
		} else {
			throw new Error('Error encrypting text');
		}
	}).catch(err => {
		logger.error('Error requesting Security service');
		logger.error(err);
		throw err;
	});
}


function decryptText(req, app, data) {
	const options = {
		url: config.baseUrlSEC + `/enc/${app}/decrypt`,
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'TxnId': req.headers['TxnId'],
			'Authorization': req.headers['Authorization']
		},
		body: data,
		json: true
	};
	return httpClient.httpRequest(options).then(res => {
		if (!res) {
			logger.error('Security service down');
			throw new Error('Security service down');
		}
		if (res.statusCode === 200) {
			return res.body.data;
		} else {
			throw new Error('Error decrypting text');
		}
	}).catch(err => {
		logger.error('Error requesting Security service');
		logger.error(err);
		throw err;
	});
}

function generatePassword(length) {
	var text = '';
	var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (var i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

async function createKeys(req, data) {
	try {
		const options = {
			url: config.baseUrlSEC + '/keys',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'TxnId': req.headers['TxnId'],
				'Authorization': req.headers['Authorization']
			},
			body: {
				id: data._id,
				app: data.app,
				type: data.type,
				name: data.name
			},
			json: true
		};
		const res = await httpClient.httpRequest(options);
		if (!res) {
			logger.error('Security service down');
			throw new Error('Security service down');
		}
		if (res.statusCode === 200) {
			return res.body.data;
		} else {
			throw new Error('Error creating keys');
		}
	} catch (err) {
		logger.error('Error creating keys');
		logger.error(err);
		throw err;
	}
}


async function deleteKeys(req, data) {
	try {
		const options = {
			url: config.baseUrlSEC + '/keys/' + data._id,
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
				'TxnId': req.headers['TxnId'],
				'Authorization': req.headers['Authorization']
			},
			json: true
		};
		const res = await httpClient.httpRequest(options);
		if (!res) {
			logger.error('Security service down');
			throw new Error('Security service down');
		}
		if (res.statusCode === 200) {
			return res.body.data;
		} else {
			throw new Error('Error deleting keys');
		}
	} catch (err) {
		logger.error('Error deleting keys');
		logger.error(err);
		throw err;
	}
}

module.exports.encryptText = encryptText;
module.exports.decryptText = decryptText;
module.exports.generatePassword = generatePassword;
module.exports.createKeys = createKeys;
module.exports.deleteKeys = deleteKeys;