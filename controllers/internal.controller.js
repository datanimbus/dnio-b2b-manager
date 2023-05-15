const router = require('express').Router();
const log4js = require('log4js');
const mongoose = require('mongoose');
const config = require('../config');

const logger = log4js.getLogger(global.loggerName);

// const indexUtils = require('../utils/indexes.utils');

router.get('/env', async (req, res) => {
	try {
		let envVars = {};
		config.envVarsForFlows.forEach(key => {
			envVars[key] = process.env[key];
		});
		envVars['NODE_OPTIONS'] = `--max-old-space-size=${config.maxHeapSize}`;
		envVars['NODE_ENV'] = 'production';
		res.status(200).json(envVars);
	} catch (err) {
		logger.error(`[${req.get('TxnId')}] Error Fetching ENV - ${err.message}`);
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

router.delete('/app/:id', async (req, res) => {
	try {
		const app = req.params.id;
		let promises;
		if (!app) {
			return res.status(400).json({ message: 'App is required' });
		}
		logger.info(`[${req.get('TxnId')}] Processing App Delete Request - ${app}`);

		res.json({ message: 'Delete process queued' });

		// Deleting Data Formats
		logger.debug(`[${req.get('TxnId')}] Deleting Data Formats`);
		const dataFormatDocs = await mongoose.model('dataFormat').find({ app: app });
		logger.trace(`[${req.get('TxnId')}] Data Formats to delete - ${JSON.stringify(dataFormatDocs)}`);
		promises = dataFormatDocs.map(doc => {
			doc._req = req;
			return doc.remove(req).catch(err => logger.error(`[${req.get('TxnId')}] Error Deleting Data Formats - ${err.message}`));
		});
		await Promise.all(promises);
		logger.debug(`[${req.get('TxnId')}] Data formats deleted`);

		// Deleting Partners
		// logger.debug(`[${req.get('TxnId')}] Deleting Partners`);
		// const partnerDocs = await mongoose.model('partners').find({ app: app });
		// logger.trace(`[${req.get('TxnId')}] Partners to delete - ${JSON.stringify(partnerDocs)}`);
		// promises = partnerDocs.map(doc => {
		// 	doc._req = req;
		// 	return doc.remove(req).catch(err => logger.error(`[${req.get('TxnId')}] Error Deleting Partners - ${err.message}`));
		// });
		// await Promise.all(promises);
		// logger.debug(`[${req.get('TxnId')}] Partners deleted`);

		// Deleting Agents
		logger.debug(`[${req.get('TxnId')}] Deleting Agents`);
		const agentDocs = await mongoose.model('agent').find({ app: app });
		logger.trace(`[${req.get('TxnId')}] Agents to delete - ${JSON.stringify(agentDocs)}`);
		promises = agentDocs.map(doc => {
			doc._req = req;
			return doc.remove(req).catch(err => logger.error(`[${req.get('TxnId')}] Error Deleting Agents - ${err.message}`));
		});
		await Promise.all(promises);
		logger.debug(`[${req.get('TxnId')}] Agents deleted`);

		// Deleting Flows
		logger.debug(`[${req.get('TxnId')}] Deleting Flows`);
		const flowDocs = await mongoose.model('flow').find({ app: app });
		logger.trace(`[${req.get('TxnId')}] Flows to delete - ${JSON.stringify(flowDocs)}`);
		promises = flowDocs.map(doc => {
			doc._req = req;
			return doc.remove(req).catch(err => logger.error(`[${req.get('TxnId')}] Error Deleting Flows - ${err.message}`));
		});
		await Promise.all(promises);
		logger.debug(`[${req.get('TxnId')}] Flows deleted`);

		// Deleting FaaS
		logger.debug(`[${req.get('TxnId')}] Deleting FaaS`);
		const faasDocs = await mongoose.model('faas').find({ app: app });
		logger.trace(`[${req.get('TxnId')}] FaaS to delete - ${JSON.stringify(faasDocs)}`);
		promises = faasDocs.map(doc => {
			doc._req = req;
			return doc.remove(req).catch(err => logger.error(`[${req.get('TxnId')}] Error Deleting FaaS - ${err.message}`));
		});
		await Promise.all(promises);
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