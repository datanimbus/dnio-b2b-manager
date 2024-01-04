const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const log4js = require('log4js');
const { Worker } = require('worker_threads');

const config = require('../config');
const httpClient = require('../http-client');

const logger = log4js.getLogger(global.loggerName);


function encryptText(app, text) {
	return executeCipher(null, 'encrypt', app, text);
}


function decryptText(app, text) {
	return executeCipher(null, 'decrypt', app, text);
}

function md5(text) {
	return crypto.createHash('md5').update(text).digest('hex');
}

/**
 * 
 * @param {string} txnId The txnId of the current request
 * @param {string} text The text data to send in thread for encryption/decryption
 */
async function executeCipher(txnId, action, app, text) {
	logger.debug(`[${txnId}] Exec. thread :: cipher`);
	const data = await getKeys(app);
	return await new Promise((resolve, reject) => {
		const appEncryptionKey = data.appEncryptionKey;
		const encryptionKey = data.encryptionKey;
		let responseSent = false;
		const filePath = path.join(process.cwd(), 'threads', 'cipher.js');
		if (!fs.existsSync(filePath)) {
			logger.error(`[${txnId}] Exec. thread :: cipher :: INVALID_FILE`);
			return reject(new Error('INVALID_FILE'));
		}
		const worker = new Worker(filePath, {
			workerData: {
				text,
				appEncryptionKey,
				encryptionKey,
				action
			}
		});
		worker.on('message', function (data) {
			responseSent = true;
			worker.terminate();
			resolve(data);
		});
		worker.on('error', reject);
		worker.on('exit', code => {
			if (!responseSent) {
				logger.error(`[${txnId}] Exec. thread :: cipher :: Worker stopped with exit code ${code}`);
				reject(new Error(`Worker stopped with exit code ${code}`));
			}
		});
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

async function getKeys(app) {
	try {
		logger.trace('Ping USER service');
		const options = {
			url: config.baseUrlUSR + '/' + app + '/keys',
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'JWT ' + global.BM_TOKEN
			},
			responseType: 'json'
		};
		const res = await httpClient.httpRequest(options);
		if (res.statusCode === 200) {
			const body = res.body;
			logger.trace('Found Keys', body);
			return body;
		} else {
			logger.error(res.statusCode, res.body);
			throw new Error(res.body);
		}
	} catch (err) {
		logger.error('Error pinging user-manager ::', err);
		throw err;
	}
}

module.exports.encryptText = encryptText;
module.exports.decryptText = decryptText;
module.exports.generatePassword = generatePassword;
module.exports.createKeys = createKeys;
module.exports.deleteKeys = deleteKeys;
module.exports.md5 = md5;
module.exports.executeCipher = executeCipher;