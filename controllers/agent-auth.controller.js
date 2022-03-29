const router = require('express').Router();
const log4js = require('log4js');
const mongoose = require('mongoose');
const JWT = require('jsonwebtoken');

const config = require('../config');
const securityUtils = require('../utils/security.utils');

const logger = log4js.getLogger('agent.controller');
const agentModel = mongoose.model('agent');


router.post('/login', async (req, res) => {
	try {
		const agentId = req.body.agentId;
		const agentPassword = req.body.password;
		const doc = await agentModel.findOne({ agentId: agentId });
		if (!doc) {
			return res.status(404).json({
				message: 'Invalid Credentials'
			});
		}
		let result = await securityUtils.decryptText(doc.app, doc.password);
		if (!result || result.statusCode != 200) {
			return res.status(404).json({
				message: 'Invalid Credentials'
			});
		}
		if (result.body.data != agentPassword) {
			return res.status(404).json({
				message: 'Invalid Credentials'
			});
		}
		result = await securityUtils.decryptText(doc.app, doc.secret);
		if (!result || result.statusCode != 200) {
			return res.status(404).json({
				message: 'Unable to Decrypt Text'
			});
		}
		const temp = doc.toObject();
		delete temp.password;
		delete temp.secret;
		delete temp.status;

		const token = JWT.sign(temp, config.secret, { expiresIn: '2h' });

		temp.token = token;
		temp.secret = result.body.data;
		doc.lastLoggedIn = new Date();
		doc.status = 'RUNNING';
		doc._req = req;
		result = await doc.save();
		logger.debug('Agent Status Updated', result);
		res.status(200).json(temp);
	} catch (err) {
		logger.error(err);
		res.status(500).json({ message: err.message });
	}
});

module.exports = router;