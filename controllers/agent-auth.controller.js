const router = require('express').Router();
const log4js = require('log4js');
const mongoose = require('mongoose');

// const config = require('../config');

const logger = log4js.getLogger('agent.controller');
const agentModel = mongoose.model('agent');


router.post('/login', async (req, res) => {
	try {
		const agentId = req.body.agentId;
		// const agentPassword = req.body.password;
		const doc = await agentModel.findOne({ agentId: agentId });
		res.status(200).json(doc);
	} catch (err) {
		logger.error(err);
		res.status(500).json({ message: err.message });
	}
});

module.exports = router;