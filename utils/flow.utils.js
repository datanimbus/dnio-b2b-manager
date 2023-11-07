const mongoose = require('mongoose');
const log4js = require('log4js');
const { v4: uuid } = require('uuid');
// const _ = require('lodash');

const config = require('../config');
const mongooseUtils = require('./mongoose.utils');


const logger = log4js.getLogger(global.loggerName);
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
		interactionData.headers = {};
		interactionData.headers['data-stack-txn-id'] = req.headers['data-stack-txn-id'];
		interactionData.headers['data-stack-remote-txn-id'] = req.headers['data-stack-remote-txn-id'];
		interactionData.headers['content-length'] = req.headers['content-length'];
		interactionData.headers['content-type'] = req.headers['content-type'];
		interactionData.app = req.params.app;
		interactionData.query = req.query;
		interactionData.params = req.params;
		interactionData.parentInteraction = req.query.parentInteraction;
		interactionData.status = 'PENDING';
		if (!interactionData._metadata) {
			interactionData._metadata = {};
		}
		interactionData._metadata.lastUpdated = new Date();
		interactionData._metadata.createdAt = new Date();
		interactionData._metadata.deleted = false;

		const collection = mongoose.connections[1].useDb(config.DATA_STACK_NAMESPACE + '-' + req.params.app).collection(`b2b.${flowId}.interactions`);
		const status = await collection.insertOne(interactionData);
		await flowModal.findOneAndUpdate({ _id: flowId }, { $set: { lastInvoked: new Date() } });
		logger.info(`Interaction Created for [${req.headers['data-stack-txn-id']}] [${req.headers['data-stack-remote-txn-id']}]`);
		logger.debug(status);
		return status;
	} catch (err) {
		logger.error(err);
		throw err;
	}
}

async function checkForUniqueRemoteTxnId(req, options) {
	try {
		const remoteTxnId = req.headers['data-stack-remote-txn-id'];
		const flowId = options.flowId;
		const flowDoc = await flowModal.findOne({ _id: flowId }).select('_id inputNode').lean();
		if (flowDoc.inputNode && flowDoc.inputNode.options && flowDoc.inputNode.options.uniqueRemoteTransaction) {
			const collection = mongoose.connections[1].useDb(config.DATA_STACK_NAMESPACE + '-' + req.params.app).collection(`b2b.${flowId}.interactions`);
			const doc = await collection.findOne({ remoteTxnId: remoteTxnId });
			if (doc) {
				logger.info(`Interaction Found for Remote Txn ID: [${req.headers['data-stack-remote-txn-id']}] :: `, doc._id);
				logger.debug(doc);
				return true;
			} else {
				return false;
			}
		}
		return false;
	} catch (err) {
		logger.error(err);
		throw err;
	}
}


module.exports.validatePayload = validatePayload;
module.exports.createInteraction = createInteraction;
module.exports.checkForUniqueRemoteTxnId = checkForUniqueRemoteTxnId;