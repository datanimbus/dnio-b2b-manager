const router = require('express').Router({ mergeParams: true });
const log4js = require('log4js');

const mongoCache = require('../utils/mongo.cache.utils');

const logger = log4js.getLogger(global.loggerName);


router.get('/:agentId/sessions', async (req, res) => {
	try {
		const agentId = req.params.agentId;
		const docs = await mongoCache.listData({ 'data.agentId': agentId });
		return res.status(200).json(docs);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.put('/:agentId/sessions/:id/:action', async (req, res) => {
	try {
		// const agentId = req.params.agentId;
		const sessionId = req.params.id;
		const action = req.params.action;
		if (action !== 'Enabled' && action !== 'Disabled') {
			return res.status(400).json({ message: 'Invalid Action' });
		}
		const status = await mongoCache.setStatus(sessionId, action);
		return res.status(200).json(status);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});


module.exports = router;