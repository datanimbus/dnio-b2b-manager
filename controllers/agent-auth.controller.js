const router = require('express').Router();
const log4js = require('log4js');
const mongoose = require('mongoose');
const JWT = require('jsonwebtoken');

const config = require('../config');
const securityUtils = require('../utils/security.utils');
const cacheUtils = require('../utils/cache.utils');
const mongoCache = require('../utils/mongo.cache.utils');

const logger = log4js.getLogger(global.loggerName);
const agentModel = mongoose.model('agent');


router.post('/login', async (req, res) => {
	try {
		const agentId = req.body.agentId;
		const agentPassword = req.body.password;
		const doc = await agentModel.findOne({ agentId: agentId });
		if (!doc) {
			return res.status(400).json({
				message: 'Invalid Credentials'
			});
		}
		if (doc && !doc.active) {
			return res.status(403).json({
				status: 'DISABLED'
			});
		}
		if (doc.status === 'RUNNING') {
			return res.status(403).json({
				status: 'ALREADY_RUNNING'
			});
		}
		let result = await securityUtils.decryptText(doc.app, doc.password);
		if (!result || result.statusCode != 200) {
			return res.status(400).json({
				message: 'Invalid Credentials'
			});
		}
		if (result.body.data != agentPassword) {
			return res.status(400).json({
				message: 'Invalid Credentials'
			});
		}
		result = await securityUtils.decryptText(doc.app, doc.secret);
		if (!result || result.statusCode != 200) {
			return res.status(400).json({
				message: 'Unable to Decrypt Text'
			});
		}
		const temp = doc.toObject();
		delete temp.password;
		delete temp.secret;
		delete temp.status;

		const token = JWT.sign(temp, config.RBAC_JWT_KEY, { expiresIn: '2h' });

		await cacheUtils.whitelistToken(agentId, token);

		temp.token = token;
		temp.secret = result.body.data;
		doc.lastLoggedIn = new Date();
		doc.status = 'RUNNING';
		doc._req = req;
		result = await doc.save();
		logger.debug('Agent Logged In :', doc.lastLoggedIn);
		temp.encryptionKey = config.encryptionKey;
		temp.uploadRetryCounter = config.uploadRetryCounter;
		temp.downloadRetryCounter = config.downloadRetryCounter;
		temp.maxConcurrentUploads = config.maxConcurrentUploads;
		temp.maxConcurrentDownloads = config.maxConcurrentDownloads;
		logger.debug('Agent auth response :', temp);

		/** Setting Token in Mongo DB Cache with TTL for Blacklisting 
		 * ---START---
		*/
		const tokenData = {};
		tokenData._id = temp._id;
		tokenData.app = temp.app;
		tokenData.agentId = temp.agentId;
		tokenData.name = temp.name;
		tokenData.lastLoggedIn = temp.lastLoggedIn;
		tokenData.token = temp.token.substr(temp.token.length - 6);
		const key = securityUtils.md5(token);
		const expireAfter = new Date();
		expireAfter.setHours(expireAfter.getHours() + 2);
		mongoCache.setData(key, tokenData, expireAfter);
		/** ---END--- */

		res.status(200).json(temp);
	} catch (err) {
		logger.error(err);
		res.status(500).json({ message: err.message });
	}
});

module.exports = router;