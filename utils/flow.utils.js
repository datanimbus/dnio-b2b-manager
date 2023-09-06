const mongoose = require('mongoose');
const log4js = require('log4js');
const { v4: uuid } = require('uuid');
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
		interactionData.flowId = flowId;
		interactionData.headers = req.headers;
		interactionData.app = req.params.app;
		interactionData.parentInteraction = req.query.parentInteraction;
		interactionData.status = 'PENDING';

		const doc = new interactionModal(interactionData);

		// let flowDoc = await flowModal.findById(flowId);
		// flowDoc.lastInvoked = doc._metadata.createdAt;
		// delete flowDoc.version;
		// await flowDoc.save();
		await flowModal.findOneAndUpdate({ _id: flowId }, { $set: { lastInvoked: doc._metadata.createdAt } });

		doc._req = req;
		const status = await doc.save();
		logger.info(`Interaction Created for [${req.headers['data-stack-txn-id']}] [${req.headers['data-stack-remote-txn-id']}]`);
		logger.debug(status);
		return status;
	} catch (err) {
		logger.error(err);
	}
}



module.exports.validatePayload = validatePayload;
module.exports.createInteraction = createInteraction;