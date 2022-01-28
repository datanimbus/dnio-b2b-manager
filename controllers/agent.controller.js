const router = require('express').Router();
const log4js = require('log4js');
const mongoose = require('mongoose');

const logger = log4js.getLogger('agent.controller');
const agentModel = mongoose.model('agent');


router.post('/login', async (req, res) => {
    try {
    } catch (err) {
        logger.error(err);
    }
});

router.post('/heartbeat', async (req, res) => {
    try {
        logger.info(`[${req.get('TxnId')}] Processing HeartBeat Action`);
        logger.trace(`[${req.get('TxnId')}] HeartBeat Action Body - `, JSON.stringify(req.body));

        let monitoringLedgerEntries = req.body.monitoringLedgerEntries;
        let agentList = monitoringLedgerEntries.map(item => item.agentId);
        let promises = [];
        let promise = Promise.resolve();

        logger.debug(`[${req.get('TxnId')}] Monitoring Ledger Entries length - `, monitoringLedgerEntries.length);

        if (monitoringLedgerEntries) {
            promises = monitoringLedgerEntries.map(async (entry) => {
                logger.trace(`[${req.get('TxnId')}] Monitor Ledger Entry - `, JSON.stringify(entry));
                entry.timestamp = new Date(entry.timestamp);
                let agent;
                try {
                    agent = await agentModel.findOne({ agentId: entry.agentId, '_metadata.deleted': false });
                } catch (err) {
                    logger.error(`[${req.get('TxnId')}] Error finding Agent Registry - `, err);
                    throw err;
                }
                logger.debug(`[${req.get('TxnId')}] Agent Registry found - `, entry.agentId, agent._metadata.lastUpdated);
                if (agent._metadata && !agent._metadata.deleted && agent.status !== 'DISABLED') {
                    entry.appName = agent.app;
                    entry.partnerName = agent.partner;
                    agent.status = entry.status;
                    if (entry.agentName) agent.name = entry.agentName;
                    let keys = ['macAddress', 'ipAddress', 'absolutePath', 'release', 'pendingFiles'];
                    keys.forEach(_k => {
                        agent[_k] = entry[_k];
                    });
                    agent.markModified('_metadata.lastUpdated');
                    agent._metadata.lastUpdated = new Date();
                    const status = await agent.save(req);
                    logger.debug(`[${req.get('TxnId')}] Agent Registry Updated - `, entry.agentId, agent._metadata.lastUpdated);
                    logger.trace(`[${req.get('TxnId')}] Agent Registry Update Response - `, JSON.stringify(status));
                }
                const savedEntry = await mongoose.model('agent.logs').create(entry);
                logger.info(`[${txnId}] Create Agent Monitoring Entry`);

                logger.trace(`[${txnId}] Monitoring Entry Agent List - `, agentList);
                const agents = await agentModel.find({ agentId: { $nin: agentList }, '_metadata.deleted': false });
                let promises = agents.map(item => {
                    let ledgerEntry = {
                        'agentId': item.agentId,
                        'responseAgentID': '',
                        'heartBeatFrequency': envConfig.hbFrequency.toString(),
                        'macAddress': item.macAddress,
                        'ipAddress': item.ipAddress,
                        'status': 'NO_RESPONSE',
                        'timestamp': new Date(),
                        'agentType': item.type,
                        'appName': item.app,
                        'release': item.release,
                        'pendingFiles': item.pendingFiles
                    };
                    logger.trace(`[${txnId}] Creating MonitorLedger Entry - ${JSON.stringify(ledgerEntry)}`);
                    return mongoose.model('agent.logs').create(ledgerEntry);
                });
                return Promise.all(promises);
            });
            promise = await Promise.all(promises);
            let transferLedgerEntries = req.body.transferLedgerEntries;

            logger.debug(`[${req.get('TxnId')}] Transfer Ledger Entries length - `, transferLedgerEntries.length);
            logger.trace(`[${req.get('TxnId')}] Transfer Ledger Entries - `, JSON.stringify({ transferLedgerEntries }));

            if (transferLedgerEntries && transferLedgerEntries.length > 0) {
                transferLedgerEntries = transferLedgerEntries.map(_tLE => {
                    _tLE.timestamp = new Date(_tLE.timestamp);
                    return _tLE;
                });
                try {
                    transferLedgerEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
                } catch (err) {
                    // do nothing
                }

                logger.trace(`[${req.get('TxnId')}] Transfer Ledger Entries after updating - `, JSON.stringify({ transferLedgerEntries }));

                return transferLedgerEntries.reduce((acc, curr) => {
                    return acc.then(() => processTransferLedgerEntries(curr, req.get('TxnId')))
                        .catch(err => {
                            logger.error(`[${req.get('TxnId')}] Error in processing Transfer Ledger Entries - `, err.message);
                            return Promise.resolve();
                        });
                }, Promise.resolve());
            }
        }
    } catch (err) {
        logger.error(err);
        if (typeof err === 'string') {
            return res.status(500).json({
                message: err
            });
        }
        res.status(500).json({
            message: err.message
        });
    }
});

module.exports = router;