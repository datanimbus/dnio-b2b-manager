const router = require('express').Router({ mergeParams: true });
const log4js = require('log4js');
const mongoose = require('mongoose');
const _ = require('lodash');

const queryUtils = require('../utils/query.utils');
const deployUtils = require('../utils/deploy.utils');
const flowUtils = require('../utils/flow.utils');
const config = require('../config');

const logger = log4js.getLogger(global.loggerName);
const flowModel = mongoose.model('flow');

function mergeCustomizer(objValue, srcValue) {
	if (_.isArray(objValue)) {
		return srcValue;
	}
}

router.get('/', async (req, res) => {
	try {
		const filter = queryUtils.parseFilter(req.query.filter);
		if (filter) {
			filter.app = req.locals.app;
		}
		if (req.query.countOnly) {
			const count = await flowModel.countDocuments(filter);
			return res.status(200).json(count);
		}
		const data = queryUtils.getPaginationData(req);
		const docs = await flowModel.find(filter).select(data.select).sort(data.sort).skip(data.skip).limit(data.count).lean();
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
		let mongoQuery = flowModel.findById(req.params.id);
		if (req.query.select) {
			mongoQuery = mongoQuery.select(req.query.select);
		}
		let doc = await mongoQuery.lean();
		if (!doc) {
			return res.status(404).json({
				message: 'Flow Not Found'
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
		const errorMsg = flowUtils.validatePayload(payload);
		if (errorMsg) {
			return res.status(400).json({ message: errorMsg });
		}
		delete payload.__v;
		delete payload.version;
		delete payload.deploymentName;
		delete payload.namespace;
		const doc = new flowModel(payload);
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
		payload.app = req.locals.app;
		const errorMsg = flowUtils.validatePayload(payload);
		if (errorMsg) {
			return res.status(400).json({ message: errorMsg });
		}
		let doc = await flowModel.findById(req.params.id);
		if (!doc) {
			return res.status(404).json({
				message: 'Flow Not Found'
			});
		}
		delete payload._id;
		delete payload.__v;
		delete payload.version;
		delete payload.deploymentName;
		delete payload.namespace;
		_.merge(doc, payload, mergeCustomizer);
		// if (payload.nodes && !_.isEmpty(payload.nodes)) {
		// 	doc.nodes = payload.nodes;
		// }
		doc._req = req;
		doc.markModified('inputNode');
		doc.markModified('nodes');
		doc.markModified('dataStructures');
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
		let doc = await flowModel.findById(req.params.id);
		if (!doc) {
			return res.status(404).json({
				message: 'Flow Not Found'
			});
		}
		if (doc.status != 'Stopped' && doc.status != 'Draft') {
			return res.status(400).json({
				message: 'Running flows cannot be deleted'
			});
		}
		doc._req = req;
		if (config.isK8sEnv() && doc.status == 'Active') {
			const status = await deployUtils.undeploy(doc);
			if (status.statusCode !== 200 && status.statusCode !== 202) {
				return res.status(status.statusCode).json({ message: 'Unable to stop Flow' });
			}
		}
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