const router = require('express').Router();
const log4js = require('log4js');
const mongoose = require('mongoose');

const queryUtils = require('../utils/query.utils');

const logger = log4js.getLogger('faas.controller');
const faasModel = mongoose.model('faas');
const _ = require('lodash');


router.get('/', async (req, res) => {
	try {
		const filter = queryUtils.parseFilter(req.query.filter);
		if (filter) {
			filter.app = req.locals.app;
		}
		if (req.query.countOnly) {
			const count = await faasModel.countDocuments(filter);
			return res.status(200).json(count);
		}
		const data = queryUtils.getPaginationData(req);
		const docs = await faasModel.find(filter).select(data.select).sort(data.sort).skip(data.skip).limit(data.count).lean();
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
		let mongoQuery = faasModel.findById(req.params.id);
		if (req.query.select) {
			mongoQuery = mongoQuery.select(req.query.select);
		}
		let doc = await mongoQuery.lean();
		if (!doc) {
			return res.status(404).json({
				message: 'Data Model Not Found'
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
		doc = new faasModel(payload);
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
		let doc = await faasModel.findById(req.params.id);
		if (!doc) {
			return res.status(404).json({
				message: 'Data Model Not Found'
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
		let doc = await faasModel.findById(req.params.id);
		if (!doc) {
			return res.status(404).json({
				message: 'Data Model Not Found'
			});
		}
		doc._req = req;
		await doc.remove();
		res.status(200).json({
			message: 'Document Deleted'
		});
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

module.exports = router;