const router = require('express').Router({ mergeParams: true });
const log4js = require('log4js');
const mongoose = require('mongoose');

// const config = require('../config');
const queryUtils = require('../utils/query.utils');

const logger = log4js.getLogger(global.loggerName);
const nodeModel = mongoose.model('node');

router.get('/utils/count', async (req, res) => {
	try {
		const filter = queryUtils.parseFilter(req.query.filter);
		const count = await nodeModel.countDocuments(filter);
		return res.status(200).json(count);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.get('/', async (req, res) => {
	try {
		let app = req.params.app;
		const filter = queryUtils.parseFilter(req.query.filter);
		filter.app = app;
		if (req.query.countOnly) {
			const count = await nodeModel.countDocuments(filter);
			return res.status(200).json(count);
		}
		const data = queryUtils.getPaginationData(req);
		const docs = await nodeModel.find(filter).select(data.select).sort(data.sort).skip(data.skip).limit(data.count).lean();
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
		let mongoQuery = nodeModel.findById(req.params.id);
		if (req.query.select) {
			mongoQuery = mongoQuery.select(req.query.select);
		}
		let doc = await mongoQuery.lean();
		if (!doc) {
			return res.status(404).json({
				message: 'Node Not Found'
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
		let doc = new nodeModel(payload);
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
		let doc = await nodeModel.findById(req.params.id);
		if (!doc) {
			return res.status(404).json({
				message: 'Node Not Found'
			});
		}
		payload.version = doc.version + 1;
		Object.keys(payload).forEach(key => {
			doc[key] = payload[key];
		});
		doc._req = req;
		let status = await doc.save();
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
		let doc = await nodeModel.findById(req.params.id);
		if (!doc) {
			return res.status(404).json({
				message: 'Plugin Not Found'
			});
		}
		doc._req = req;
		let status = await doc.remove();
		logger.debug('Plugin Deleted', status);
		res.status(200).json({
			message: 'Plugin Deleted'
		});
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

module.exports = router;