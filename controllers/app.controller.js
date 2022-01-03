const router = require('express').Router();
const log4js = require('log4js');
const mongoose = require('mongoose');

const logger = log4js.getLogger(global.loggerName);

const indexUtils = require('../utils/indexes.utils');


router.post('/', async (req, res) => {
    try {
        const app = req.body.app;
        if (!app) {
            return res.status(400).json({ message: 'App is required' });
        }
        await indexUtils.createInteractoionUniqueIndexForApp(app);
        res.status(200).json({ message: 'Create process acknowledged' });
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

router.put('/:id', async (req, res) => {
    try {
        const app = req.params.app;
        if (!app) {
            return res.status(400).json({ message: 'App is required' });
        }
        logger.info(`[${req.get('TxnId')}] Processing App Update Request - ${app}`);

        let agentTrustedIP = req.body.agentTrustedIP;
        let metadata = {
            '_id': app,
            'agentTrustedIP': agentTrustedIP,
        };
        let obj = {
            'appName': '',
            'partnerName': '',
            'flowName': '',
            'action': 'APP_TRUSTED_IP_LIST_INFO_UPDATED',
            'metaData': JSON.stringify(metadata),
            'timestamp': new Date().toString(),
            'entryType': 'IN',
            'sentOrRead': false
        };

        res.status(200).json({ 'message': 'Update process acknowledged' });
        const data = await mongoose.model('agentRegistry').findOne({ type: 'IEG' }).lean();
        if (!data) {
            return mongoose.model('agentRegistry').findOne({ type: 'IG' }).lean();
        }
        logger.debug(`[${req.get('TxnId')}] IG Agent Found`);
        logger.trace(`[${req.get('TxnId')}] IG Agent - ${JSON.stringify(data)}`);
        obj.agentID = data.agentID;
        await mongoose.model('transferEvent').create(obj);
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

router.delete('/:id', async (req, res) => {
    try {
        const app = req.params.app;
        if (!app) {
            return res.status(400).json({ message: 'App is required' });
        }
        logger.info(`[${req.get('TxnId')}] Processing App Delete Request - ${app}`);

        res.json({ message: 'Delete process queued' });

        // Deleting Data Formats
        logger.debug(`[${req.get('TxnId')}] Deleting Data Formats`);
        const dataFormatDocs = await mongoose.model('dataFormat').find({ app: app });
        logger.trace(`[${req.get('TxnId')}] Data Formats to delete - ${JSON.stringify(dataFormatDocs)}`);
        let promises = dataFormatDocs.map(doc => {
            doc._req = req;
            return doc.remove(req).catch(err => logger.error(`[${req.get('TxnId')}] Error Deleting Data Formats - ${err.message}`));
        });
        promises = await Promise.all(promises);
        logger.debug(`[${req.get('TxnId')}] Data formats deleted`);

        // Deleting Partners
        logger.debug(`[${req.get('TxnId')}] Deleting Partners`);
        const partnerDocs = await mongoose.model('partners').find({ app: app });
        logger.trace(`[${req.get('TxnId')}] Partners to delete - ${JSON.stringify(partnerDocs)}`);
        let promises = partnerDocs.map(doc => {
            doc._req = req;
            return doc.remove(req).catch(err => logger.error(`[${req.get('TxnId')}] Error Deleting Partners - ${err.message}`));
        });
        promises = await Promise.all(promises);
        logger.debug(`[${req.get('TxnId')}] Partners deleted`);

        // Deleting Agents
        logger.debug(`[${req.get('TxnId')}] Deleting Agents`);
        const agentDocs = await mongoose.model('agentRegistry').find({ app: app });
        logger.trace(`[${req.get('TxnId')}] Agents to delete - ${JSON.stringify(agentDocs)}`);
        let promises = agentDocs.map(doc => {
            doc._req = req;
            return doc.remove(req).catch(err => logger.error(`[${req.get('TxnId')}] Error Deleting Agents - ${err.message}`));
        });
        promises = await Promise.all(promises);
        logger.debug(`[${req.get('TxnId')}] Agents deleted`);

        // Deleting Flows
        logger.debug(`[${req.get('TxnId')}] Deleting Flows`);
        const flowDocs = await mongoose.model('flow').find({ app: app });
        logger.trace(`[${req.get('TxnId')}] Flows to delete - ${JSON.stringify(flowDocs)}`);
        let promises = flowDocs.map(doc => {
            doc._req = req;
            return doc.remove(req).catch(err => logger.error(`[${req.get('TxnId')}] Error Deleting Flows - ${err.message}`));
        });
        promises = await Promise.all(promises);
        logger.debug(`[${req.get('TxnId')}] Flows deleted`);

        // Deleting FaaS
        logger.debug(`[${req.get('TxnId')}] Deleting FaaS`);
        const faasDocs = await mongoose.model('faas').find({ app: app });
        logger.trace(`[${req.get('TxnId')}] FaaS to delete - ${JSON.stringify(faasDocs)}`);
        let promises = faasDocs.map(doc => {
            doc._req = req;
            return doc.remove(req).catch(err => logger.error(`[${req.get('TxnId')}] Error Deleting FaaS - ${err.message}`));
        });
        promises = await Promise.all(promises);
        logger.debug(`[${req.get('TxnId')}] FaaS deleted`);
    } catch (err) {
        logger.error(`[${req.get('TxnId')}] Error Deleting App - ${err.message}`);
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