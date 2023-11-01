const mongoose = require('mongoose');
const log4js = require('log4js');
const { v4: uuid } = require('uuid');
const config = require('../config');

const mongooseUtils = require('./mongoose.utils');

// const _ = require('lodash');

const logger = log4js.getLogger(global.loggerName);
const interactionModal = mongoose.model('interaction');
const flowModal = mongoose.model('flow');

function validatePayload(payload) {
	if (!payload.name) {
		return 'Name is mandatory';
	}
	if (!payload.inputNode || !payload.inputNode.type) {
		return 'Input Node is required';
	}
}


async function createInteraction(req, options) {
	try {
		const flowId = options.flowId;
		if (!req.headers['data-stack-txn-id']) {
			req.headers['data-stack-txn-id'] = uuid();
			logger.info(`No txn id found. Setting txn id to : ${req.headers['data-stack-txn-id']}`);
		}
		if (!req.headers['data-stack-remote-txn-id']) {
			req.headers['data-stack-remote-txn-id'] = `${uuid()}`;
			logger.info(`No remote txn id found. Setting remote txn id to : ${req.headers['data-stack-remote-txn-id']}`);
		}

		const interactionData = {};
		interactionData._id = await mongooseUtils.createId('INTR', 'b2b.interactions', null, null, 1000);
		interactionData.flowId = flowId;
		interactionData.txnId = req.headers['data-stack-txn-id'];
		interactionData.remoteTxnId = req.headers['data-stack-remote-txn-id'];
		// interactionData.headers = req.headers;
		interactionData.app = req.params.app;
		interactionData.query = req.query;
		interactionData.parentInteraction = req.query.parentInteraction;
		interactionData.status = 'PENDING';

		const doc = new interactionModal(interactionData);
		doc._req = req;
		const status = await doc.save();
		await mongoose.connections[1].useDb(config.DATA_STACK_NAMESPACE + '-' + req.params.app).collection('b2b.interactions').insertOne(interactionData);
		await flowModal.findOneAndUpdate({ _id: flowId }, { $set: { lastInvoked: new Date() } });
		logger.info(`Interaction Created for [${req.headers['data-stack-txn-id']}] [${req.headers['data-stack-remote-txn-id']}]`);
		logger.debug(status);
		return status;
	} catch (err) {
		logger.error(err);
	}
}



module.exports.validatePayload = validatePayload;
module.exports.createInteraction = createInteraction;