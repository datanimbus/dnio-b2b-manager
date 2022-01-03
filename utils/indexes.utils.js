const config = require('../config');

async function createInteractoionUniqueIndex() {
    try {
        if (!release) return null;
        logger.debug('Creating Interaction Unique Index');
        const apps = await mongoose.connection.db.collection('userMgmt.apps').find({}, { _id: 1 }).toArray();
        let promises = apps.map(_app => {
            let dbName = config.isK8sEnv() ? `${config.DATA_STACK_NAMESPACE}-${_app._id}` : _app._id;
            return fixDuplicateInteractions(dbName).then(() => {
                let mongoDBColl = global.mongoAppCenterConn.db(dbName).collection('b2b.interaction');
                let mongoDBIntrBlock = global.mongoAppCenterConn.db(dbName).collection('b2b.interaction.blocks');
                const promiseArr = [];
                promiseArr.push(mongoDBColl.createIndex({ remoteTxnId: 1, dataStackTxnId: 1 }, { unique: true }));
                promiseArr.push(mongoDBColl.createIndex({
                    '_metadata.lastUpdated': 1,
                    '_metadata.createdAt': 1,
                    'status': 1,
                    'flowData.direction': 1,
                    'flowData.inputType': 1,
                    'flowData.outputType': 1,
                    'flowData.flowName': 1,
                    'flowData.partnerName': 1,
                }));
                promiseArr.push(mongoDBColl.createIndex({ 'createTimestamp': 1 }));
                promiseArr.push(mongoDBIntrBlock.createIndex({
                    '_metadata.lastUpdated': 1,
                    '_metadata.createdAt': 1,
                    'sequenceNo': 1,
                    'dataStackTxnId': 1,
                    'remoteTxnId': 1
                }));
                return Promise.all(promiseArr).then(_d => {
                    logger.debug(`Unique Index created for Interaction of App - ${_app._id} ${JSON.stringify(_d)}`);
                    return _d;
                }).catch(err => {
                    logger.error(`Unique Index creation failed for Interaction of App - ${_app._id}`, err);
                });
            });
        });
        return new Promise((resolve) => {
            Promise.all(promises).then(() => { resolve(); }).catch(() => { resolve(); });
        });
    } catch (e) {
        logger.error('Unique Index creation failed', e);
    }
}


async function fixDuplicateInteractions(dbName) {
    try {
        let mongoDBColl = global.mongoAppCenterConn.db(dbName).collection('b2b.interaction');
        const docs = await mongoDBColl.aggregate([
            {
                $project: { _id: 1, remoteTxnId: 1, dataStackTxnId: 1 }
            },
            {
                $group: {
                    _id: {
                        remoteTxnId: '$remoteTxnId',
                        dataStackTxnId: '$dataStackTxnId'
                    },
                    interactions: {
                        $push: '$$ROOT'
                    }
                }
            }
        ]).toArray();
        if (docs && docs.length > 0) {
            const status = await docs.reduce((prev, curr) => {
                return prev.then(() => {
                    const arr = curr.interactions.map((item, i) => {
                        if (i > 0) {
                            return mongoDBColl.updateOne({ _id: item._id }, {
                                $set: {
                                    remoteTxnId: `${item.remoteTxnId}_dup_${i}`,
                                    dataStackTxnId: `${item.dataStackTxnId}_dup_${i}`
                                }
                            });
                        } else {
                            return Promise.resolve();
                        }
                    });
                    return Promise.all(arr);
                });
            }, Promise.resolve());
            logger.trace(status);
        }
        logger.debug('Duplicate Interactions Fixed for DB - ', dbName);
    } catch (e) {
        logger.error('fixDuplicateInteractions', e);

    }
}

async function createInteractoionUniqueIndexForApp(appName) {
    try {
        let dbName = config.isK8sEnv() ? `${config.DATA_STACK_NAMESPACE}-${appName}` : appName;
        return fixDuplicateInteractions(dbName).then(() => {
            let mongoDBColl = global.mongoAppCenterConn.db(dbName).collection('b2b.interaction');
            let mongoDBIntrBlock = global.mongoAppCenterConn.db(dbName).collection('b2b.interaction.blocks');
            const promiseArr = [];
            promiseArr.push(mongoDBColl.createIndex({ remoteTxnId: 1, dataStackTxnId: 1 }, { unique: true }));
            promiseArr.push(mongoDBColl.createIndex({
                '_metadata.lastUpdated': 1,
                '_metadata.createdAt': 1,
                'status': 1,
                'flowData.direction': 1,
                'flowData.inputType': 1,
                'flowData.outputType': 1,
                'flowData.flowName': 1,
                'flowData.partnerName': 1,
            }));
            promiseArr.push(mongoDBIntrBlock.createIndex({
                '_metadata.lastUpdated': 1,
                '_metadata.createdAt': 1,
                'sequenceNo': 1,
                'dataStackTxnId': 1,
                'remoteTxnId': 1
            }));
            return Promise.all(promiseArr).then(_d => {
                logger.debug(`Unique Index created for Interaction of App - ${appName} ${JSON.stringify(_d)}`);
                return _d;
            }).catch(err => {
                logger.error(`Unique Index creation failed for Interaction of App - ${appName}`, err);
            });
        });
    } catch (e) {
        logger.error('Unique Index creation failed', e);
    }
}


module.exports.createInteractoionUniqueIndexForApp = createInteractoionUniqueIndexForApp;
module.exports.createInteractoionUniqueIndex = createInteractoionUniqueIndex;