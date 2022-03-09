const log4js = require('log4js');
const { v4: uuid } = require('uuid');

const logger = log4js.getLogger(global.loggerName);

function getState(req, stateId, isChild) {
	const data = {};
	data._id = uuid();
	data.stateId = stateId;
	data.txnId = isChild ? uuid() : req.headers['data-stack-txn-id'];
	data.remoteTxnId = req.headers['data-stack-remote-txn-id'];
	data.parentTxnId = isChild ? req.headers['data-stack-txn-id'] : null;
	data.headers = req.headers;
	data.body = req.body;
	data.status = 'Init';
	return data;
}

async function upsertState(req, state) {
	const txnId = state.txnId;
	const remoteTxnId = state.remoteTxnId;
	logger.trace(`[${txnId}] [${remoteTxnId}] Starting Upsert Stage: ${JSON.stringify(state._id)}`);
	try {
		await global.appcenterDB.collection('b2b.state').findOneAndUpdate(
			{ stateId: state.stateId, txnId: state.txnId, remoteTxnId: state.remoteTxnId, parentTxnId: state.parentTxnId },
			{ $set: state },
			{ upsert: true }
		);
		logger.trace(`[${txnId}] [${remoteTxnId}] Ending Upsert Stage: ${JSON.stringify(state._id)}`);
	} catch (err) {
		logger.trace(`[${txnId}] [${remoteTxnId}] Ending Upsert Stage With Error: ${JSON.stringify(state._id)}`);
		// logger.error(err);
	}
}

module.exports.getState = getState;
module.exports.upsertState = upsertState;