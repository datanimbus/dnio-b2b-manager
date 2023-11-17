const path = require('path');
const log4js = require('log4js');
const mkdirp = require('mkdirp');
const JWT = require('jsonwebtoken');
const mongoose = require('mongoose');
const cron = require('node-cron');

const config = require('./config');
// const httpClient = require('./http-client');

const logger = log4js.getLogger(global.loggerName);

function init() {
	const token = JWT.sign({ name: 'DS_B2B_MANAGER', _id: 'admin', isSuperAdmin: true }, config.RBAC_JWT_KEY);
	global.BM_TOKEN = token;

	const folderPath = process.cwd();
	mkdirp.sync(path.join(folderPath, 'downloads'));

	agentStatusCron();
	interactionsCleanCron();
}

function agentStatusCron() {
	const agentModel = mongoose.model('agent');
	const agentActionModel = mongoose.model('agent-action');

	if (config.hbMissCount < 1) {
		config.hbMissCount = 1;
	}
	cron.schedule('*/2 * * * *', function () {
		logger.info('Running cron to update agent status');
		let dateFilter = new Date();
		logger.trace('New Date ', dateFilter);
		dateFilter.setSeconds(config.hbFrequency * config.hbMissCount * -1);
		logger.trace('Date ', dateFilter);
		let findFilter = { status: { '$nin': ['STOPPED', 'DISABLED', 'PENDING'] }, '_metadata.lastUpdated': { '$lte': dateFilter } };
		logger.trace('findFilter', JSON.stringify(findFilter));
		return agentModel.find(findFilter).lean()
			.then(agents => {
				if (agents && agents.length > 0) {
					agents.forEach(agent => {
						const actionDoc = new agentActionModel({
							agentId: agent.agentId,
							action: 'AGENT_STOPPED'
						});
						let status = actionDoc.save();
						logger.trace('Agent Status Updated - ', JSON.stringify(status));
					});
				}
			}).then(() => {
				return agentModel.updateMany({ status: { '$nin': ['STOPPED', 'DISABLED'] }, '_metadata.lastUpdated': { '$lte': dateFilter } }, { $set: { status: 'STOPPED', '_metadata.lastUpdated': new Date() } }, { multi: true });
			})
			.then((_d) => {
				logger.debug('Agent status cron result - ' + JSON.stringify(_d));
				// return fileTokensUpdate();
			})
			.catch(err => {
				logger.error(err);
			});
	});
}


function interactionsCleanCron() {
	cron.schedule('0 */6 * * *', async function () {
		logger.info('Running cron to clean interactions');
		try {
			let appCache = {};
			let flowList = await mongoose.connection.db.collection('b2b.flows').find({}).project({ _id: 1, app: 1 }).toArray();
			logger.debug('Flows Found:', flowList.length);
			await flowList.reduce(async (prev, flow) => {
				try {
					await prev;
					logger.debug('Triggering Cleanup for Flow:', flow._id);
					if (!appCache[flow.app]) {
						appCache[flow.app] = await mongoose.connection.db.collection('userMgmt.apps').findOne({ _id: flow.app }, { projection: { _id: 1, interactionStore: 1 } });
					}
					let appData = appCache[flow.app];
					if (appData && appData.interactionStore
						&& appData.interactionStore.retainPolicy
						&& appData.interactionStore.retainPolicy
						&& appData.interactionStore.retainPolicy.retainValue > -1) {
						const retainValue = +appData.interactionStore.retainPolicy.retainValue;
						const appDB = mongoose.connections[1].useDb(config.DATA_STACK_NAMESPACE + '-' + flow.app);
						const col1 = appDB.collection(`b2b.${flow._id}.interactions`);
						const col2 = appDB.collection(`b2b.${flow._id}.node-state`);
						const col3 = appDB.collection(`b2b.${flow._id}.node-state.data`);

						createIndexIfNotExists(col1, col2, col3);

						if (appData.interactionStore.retainPolicy.retainType == 'count') {
							await removeDocsBasedOnCount(col1, retainValue);
							await removeDocsBasedOnCount(col2, retainValue);
							await removeDocsBasedOnCount(col3, retainValue);
						} else {
							await removeDocsBasedOnDays(col1, retainValue);
							await removeDocsBasedOnDays(col2, retainValue);
							await removeDocsBasedOnDays(col3, retainValue);
						}
					}
				} catch (err) {
					logger.debug('Error Occured for Flow:', flow._id);
					logger.error(err);
				}
			});
			appCache = null;
			flowList = null;
		} catch (err) {
			logger.error(err);
		}
	});
}

function removeDocsBasedOnCount(col, retainValue) {
	const latestIds = col.find({}, { _id: 1 }).sort({ _id: -1 }).limit(retainValue).map(doc => doc._id);
	logger.debug('Keeping These Records:', JSON.stringify(latestIds));
	const status = col.deleteMany({ _id: { $nin: latestIds } });
	logger.debug('Delete Status :', JSON.stringify(status));
	return status;
}

function removeDocsBasedOnDays(col, retainValue) {
	const daysAgo = new Date();
	daysAgo.setDate(daysAgo.getDate() - retainValue);
	logger.debug('Removing Records Older Then:', daysAgo);
	const status = col.deleteMany({ timestamp: { $lt: daysAgo } });
	logger.debug('Delete Status :', JSON.stringify(status));
	return status;
}

async function createIndexIfNotExists(col1, col2, col3) {
	if (!col1.indexExists('txnId_1_remoteTxnId_1')) {
		try {
			await col1.createIndex({ txnId: 1, remoteTxnId: 1 });
		} catch (err) {
			logger.error(`Error while Creating Index [txnId_1_remoteTxnId_1] in collection [${col1.name}]`);
			logger.error(err);
		}
	}
	if (!col1.indexExists('status_1')) {
		try {
			await col1.createIndex({ status: 1 });
		} catch (err) {
			logger.error(`Error while Creating Index [status_1] in collection [${col1.name}]`);
			logger.error(err);
		}
	}
	if (!col1.indexExists('_metadata.lastUpdated_1')) {
		try {
			await col1.createIndex({ '_metadata.lastUpdated': 1 });
		} catch (err) {
			logger.error(`Error while Creating Index [_metadata.lastUpdated_1] in collection [${col1.name}]`);
			logger.error(err);
		}
	}
	if (!col1.indexExists('_metadata.createdAt_1')) {
		try {
			await col1.createIndex({ '_metadata.createdAt': 1 });
		} catch (err) {
			logger.error(`Error while Creating Index [_metadata.createdAt_1] in collection [${col1.name}]`);
			logger.error(err);
		}
	}

	if (!col2.indexExists('interactionId_1')) {
		try {
			await col2.createIndex({ interactionId: 1 });
		} catch (err) {
			logger.error(`Error while Creating Index [interactionId_1] in collection [${col2.name}]`);
			logger.error(err);
		}
	}
	if (!col2.indexExists('status_1')) {
		try {
			await col2.createIndex({ status: 1 });
		} catch (err) {
			logger.error(`Error while Creating Index [status_1] in collection [${col2.name}]`);
			logger.error(err);
		}
	}
	if (!col2.indexExists('_metadata.lastUpdated_1')) {
		try {
			await col2.createIndex({ '_metadata.lastUpdated': 1 });
		} catch (err) {
			logger.error(`Error while Creating Index [_metadata.lastUpdated_1] in collection [${col2.name}]`);
			logger.error(err);
		}
	}
	if (!col2.indexExists('_metadata.createdAt_1')) {
		try {
			await col2.createIndex({ '_metadata.createdAt': 1 });
		} catch (err) {
			logger.error(`Error while Creating Index [_metadata.createdAt_1] in collection [${col2.name}]`);
			logger.error(err);
		}
	}

	if (!col3.indexExists('interactionId_1_nodeId_1')) {
		try {
			await col3.createIndex({ interactionId: 1, nodeId: 1 });
		} catch (err) {
			logger.error(`Error while Creating Index [interactionId_1_nodeId_1] in collection [${col3.name}]`);
			logger.error(err);
		}
	}
	if (!col3.indexExists('_metadata.lastUpdated_1')) {
		try {
			await col3.createIndex({ '_metadata.lastUpdated': 1 });
		} catch (err) {
			logger.error(`Error while Creating Index [_metadata.lastUpdated_1] in collection [${col3.name}]`);
			logger.error(err);
		}
	}
	if (!col3.indexExists('_metadata.createdAt_1')) {
		try {
			await col3.createIndex({ '_metadata.createdAt': 1 });
		} catch (err) {
			logger.error(`Error while Creating Index [_metadata.createdAt_1] in collection [${col3.name}]`);
			logger.error(err);
		}
	}
}

module.exports.init = init;