const path = require('path');
const router = require('express').Router({ mergeParams: true });
const log4js = require('log4js');
const mongoose = require('mongoose');
// const _ = require('lodash');

const config = require('../config');
const queryUtils = require('../utils/query.utils');
const storageUtils = require('../utils/storage.utils');

const logger = log4js.getLogger(global.loggerName);
// const interactionModel = mongoose.model('interaction');
// const flowModel = mongoose.model('flow');



router.get('/:flowId', async (req, res) => {
	try {
		const collection = mongoose.connections[1].useDb(config.DATA_STACK_NAMESPACE + '-' + req.params.app).collection(`b2b.${req.params.flowId}.interactions`);
		const filter = queryUtils.parseFilter(req.query.filter);
		// filter.flowId = req.params.flowId;
		if (req.query.countOnly) {
			// const count = await interactionModel.countDocuments(filter);
			const count = await collection.countDocuments(filter);
			return res.status(200).json(count);
		}
		const data = queryUtils.getPaginationData(req);

		// const docs = await interactionModel.find(filter).select(data.select).sort(data.sort).skip(data.skip).limit(data.count).lean();
		const docs = await collection.find(filter).project(data.selectObject).sort(data.sortObject).skip(data.skip).limit(data.count).toArray();
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
		const collection = mongoose.connections[1].useDb(config.DATA_STACK_NAMESPACE + '-' + req.params.app).collection(`b2b.${req.params.flowId}.interactions`);
		let doc = await collection.findOne({ _id: req.params.id });
		// let doc = await interactionModel.findById(req.params.id).lean();
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
		const collection = mongoose.connections[1].useDb(config.DATA_STACK_NAMESPACE + '-' + req.params.app).collection(`b2b.${req.params.flowId}.interactions`);
		let status = await collection.findOneAndUpdate({ _id: req.params.id }, { $set: payload }, { returnDocument: 'after' });
		let result = status.value;
		// let doc = await interactionModel.findById(req.params.id);
		// if (!doc) {
		// 	return res.status(404).json({
		// 		message: 'Data Model Not Found'
		// 	});
		// }
		// _.merge(doc, payload);
		// const status = await doc.save(req);
		res.status(200).json(result);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.get('/:flowId/:id/state', async (req, res) => {
	try {
		// let doc = await flowModel.findById(req.params.flowId).lean();
		// if (!doc) {
		// 	return res.status(404).json({
		// 		message: 'Data Model Not Found'
		// 	});
		// }

		const collection = mongoose.connections[1].useDb(config.DATA_STACK_NAMESPACE + '-' + req.params.app).collection(`b2b.${req.params.flowId}.node-state`);
		const records = await collection.find({ interactionId: req.params.id }).toArray();
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
		// let doc = await flowModel.findById(req.params.flowId).lean();
		// if (!doc) {
		// 	return res.status(404).json({
		// 		message: 'Data Model Not Found'
		// 	});
		// }
		let appData = await mongoose.connection.db.collection('userMgmt.apps').findOne({ _id: req.params.app });
		let record;
		if (appData && appData.interactionStore && appData.interactionStore.storeType != 'db') {
			let connectorData = await mongoose.connection.db.collection('config.connectors').findOne({
				_id: appData.interactionStore.configuration.connector._id,
				app: req.params.app
			});
			let blobOptions = connectorData.values;
			blobOptions.blobName = path.join(appData._id, req.params.flowId, req.params.id, req.params.stateId + '.json');
			if (appData && appData.interactionStore && appData.interactionStore.storeType == 'azureblob') {
				let data = await storageUtils.getBufferFromAzureBlob(blobOptions);
				record = JSON.parse(data);
			} else if (appData && appData.interactionStore && appData.interactionStore.storeType == 'awss3') {
				let data = await storageUtils.getBufferFromS3Bucket(blobOptions);
				record = JSON.parse(data);
			} else {
				res.status(400).json({ message: 'Invalid Store Type' });
				return;
			}
		} else {
			const collection = mongoose.connections[1].useDb(config.DATA_STACK_NAMESPACE + '-' + req.params.app).collection(`b2b.${req.params.flowId}.node-state.data`);
			record = await collection.findOne({ interactionId: req.params.id, nodeId: req.params.stateId });
		}
		res.status(200).json(record);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

module.exports = router;