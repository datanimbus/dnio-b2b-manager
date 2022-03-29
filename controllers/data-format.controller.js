const router = require('express').Router();
const log4js = require('log4js');
const mongoose = require('mongoose');
const _ = require('lodash');

const queryUtils = require('../utils/query.utils');
const commonUtils = require('../utils/common.utils');

const logger = log4js.getLogger('dataFormat.controller');
const dataFormatModel = mongoose.model('dataFormat');


router.get('/', async (req, res) => {
	try {
		const filter = queryUtils.parseFilter(req.query.filter);
		if (req.query.countOnly) {
			const count = await dataFormatModel.countDocuments(filter);
			return res.status(200).json(count);
		}
		const data = queryUtils.getPaginationData(req);
		const docs = await dataFormatModel.find(filter).select(data.select).sort(data.sort).skip(data.skip).limit(data.count).lean();
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
		let mongoQuery = dataFormatModel.findById(req.params.id);
		if (req.query.select) {
			mongoQuery = mongoQuery.select(req.query.select);
		}
		let doc = await mongoQuery.lean();
		if (!doc) {
			return res.status(404).json({
				message: 'Document Not Found'
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
		payload.app = req.locals.app;
		if (payload.definition && payload.definition.length > 0) {
			const errors = commonUtils.validateDefinition(payload.definition[0].definition);
			if (errors) {
				return res.status(400).json({ message: 'Validation Failed', errors: errors });
			}
		}
		let doc = new dataFormatModel(payload);
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
		if (payload.definition && payload.definition.length > 0) {
			const errors = commonUtils.validateDefinition(payload.definition[0].definition);
			if (errors) {
				return res.status(400).json({ message: 'Validation Failed', errors: errors });
			}
		}
		let doc = await dataFormatModel.findById(req.params.id);
		if (!doc) {
			return res.status(404).json({
				message: 'Document Not Found'
			});
		}
		delete payload._metadata;
		delete payload.__v;
		// Object.keys(payload).forEach(key => {
		// 	doc[key] = payload[key];
		// });
		_.merge(doc, payload);
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
		let doc = await dataFormatModel.findById(req.params.id);
		if (!doc) {
			return res.status(404).json({
				message: 'Document Not Found'
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