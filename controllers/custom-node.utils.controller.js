const router = require('express').Router({ mergeParams: true });
const log4js = require('log4js');
const mongoose = require('mongoose');

// const config = require('../config');
// const queryUtils = require('../utils/query.utils');

const logger = log4js.getLogger(global.loggerName);
// const nodeModel = mongoose.model('node');
const configModel = mongoose.model('b2b.category');

router.get('/category', async (req, res) => {
	try {
		const docs = await configModel.find().toArray();
		return res.status(200).json(docs);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

module.exports = router;