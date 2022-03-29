const router = require('express').Router();
const log4js = require('log4js');
const mongoose = require('mongoose');

// const config = require('../config');
const queryUtils = require('../utils/query.utils');

const logger = log4js.getLogger('agent.controller');
const agentModel = mongoose.model('agent');


router.get('/', async (req, res) => {
	try {
		const filter = queryUtils.parseFilter(req.query.filter);
		if (req.query.countOnly) {
			const count = await agentModel.countDocuments(filter);
			return res.status(200).json(count);
		}
		const data = queryUtils.getPaginationData(req);
		const docs = await agentModel.find(filter).select(data.select).sort(data.sort).skip(data.skip).limit(data.count).lean();
		res.status(200).json(docs);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.get('/:id', async (req, res) => {
	try {
		let mongoQuery = agentModel.findById(req.params.id);
		if (req.query.select) {
			mongoQuery = mongoQuery.select(req.query.select);
		}
		let doc = await mongoQuery.lean();
		if (!doc) {
			return res.status(404).json({
				message: 'Agent Not Found'
			});
		}
		res.status(200).json(doc);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.post('/', async (req, res) => {
	try {
		const payload = req.body;
		let doc = new agentModel(payload);
		doc._req = req;
		const status = await doc.save();
		res.status(200).json(status);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.put('/:id', async (req, res) => {
	try {
		const payload = req.body;
		let doc = await agentModel.findById(req.params.id);
		if (!doc) {
			return res.status(404).json({
				message: 'Agent Not Found'
			});
		}
		Object.keys(payload).forEach(key => {
			doc[key] = payload[key];
		});
		doc._req = req;
		const status = await doc.save();
		res.status(200).json(status);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.delete('/:id', async (req, res) => {
	try {
		let doc = await agentModel.findById(req.params.id);
		if (!doc) {
			return res.status(404).json({
				message: 'Agent Not Found'
			});
		}
		doc._req = req;
		await doc.remove();
		res.status(200).json({
			message: 'Agent Deleted'
		});
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

module.exports = router;