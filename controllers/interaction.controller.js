const router = require('express').Router({ mergeParams: true });
const log4js = require('log4js');
const mongoose = require('mongoose');
const _ = require('lodash');

const config = require('../config');
const queryUtils = require('../utils/query.utils');

const logger = log4js.getLogger(global.loggerName);
const interactionModel = mongoose.model('interaction');
const flowModel = mongoose.model('flow');



router.get('/:flowId', async (req, res) => {
	try {
		const filter = queryUtils.parseFilter(req.query.filter);
		filter.flowId = req.params.flowId;
		if (req.query.countOnly) {
			const count = await interactionModel.countDocuments(filter);
			return res.status(200).json(count);
		}
		const data = queryUtils.getPaginationData(req);
		const docs = await interactionModel.find(filter).select(data.select).sort(data.sort).skip(data.skip).limit(data.count).lean();
		res.status(200).json(docs);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.get('/:flowId/:id', async (req, res) => {
	try {
		let doc = await interactionModel.findById(req.params.id).lean();
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


// router.post('/:flowId/utils/update', async (req, res) => {
// 	try {
// 		const payload = req.body;
// 		let doc = await interactionModel.findById(req.params.id);
// 		if (!doc) {
// 			return res.status(404).json({
// 				message: 'Data Model Not Found'
// 			});
// 		}
// 		_.merge(doc, payload);
// 		const status = await doc.save(req);
// 		res.status(200).json(status);
// 	} catch (err) {
// 		logger.error(err);
// 		res.status(500).json({
// 			message: err.message
// 		});
// 	}
// });

router.put('/:flowId/:id', async (req, res) => {
	try {
		const payload = req.body;
		let doc = await interactionModel.findById(req.params.id);
		if (!doc) {
			return res.status(404).json({
				message: 'Data Model Not Found'
			});
		}
		_.merge(doc, payload);
		const status = await doc.save(req);
		res.status(200).json(status);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.get('/:flowId/:id/state', async (req, res) => {
	try {
		let doc = await flowModel.findById(req.params.flowId).lean();
		if (!doc) {
			return res.status(404).json({
				message: 'Data Model Not Found'
			});
		}
		const appcenterCon = mongoose.connections[1];
		const dbname = config.DATA_STACK_NAMESPACE + '-' + doc.app;
		const dataDB = appcenterCon.useDb(dbname);
		const stateCollection = dataDB.collection('b2b.node.state');
		const records = await stateCollection.find({ interactionId: req.params.id }).toArray();
		res.status(200).json(records);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.get('/:flowId/:id/state/:stateId/data', async (req, res) => {
	try {
		let doc = await flowModel.findById(req.params.flowId).lean();
		if (!doc) {
			return res.status(404).json({
				message: 'Data Model Not Found'
			});
		}
		const appcenterCon = mongoose.connections[1];
		const dbname = config.DATA_STACK_NAMESPACE + '-' + doc.app;
		const dataDB = appcenterCon.useDb(dbname);
		const stateDataCollection = dataDB.collection('b2b.node.state.data');
		const record = await stateDataCollection.findOne({ interactionId: req.params.id, nodeId: req.params.stateId });
		res.status(200).json(record);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

module.exports = router;