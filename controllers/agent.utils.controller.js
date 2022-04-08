const router = require('express').Router();
const log4js = require('log4js');
const mongoose = require('mongoose');
const JWT = require('jsonwebtoken');

const config = require('../config');
const queryUtils = require('../utils/query.utils');
const securityUtils = require('../utils/security.utils');
const cacheUtils = require('../utils/cache.utils');

const logger = log4js.getLogger('agent.controller');

const agentModel = mongoose.model('agent');
const agentActionModel = mongoose.model('agent-action');
const flowModel = mongoose.model('flow');


router.get('/count', async (req, res) => {
	try {
		const filter = queryUtils.parseFilter(req.query.filter);
		const count = await agentModel.countDocuments(filter);
		return res.status(200).json(count);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.post('/:id/init', async (req, res) => {
	try {
		const txnId = req.header('txnId');
		const agentId = req.params.id;
		logger.info(`[${txnId}] Processing Agent Init Action of -`, agentId);
		logger.trace(`[${txnId}] Agent Init Action Body -`, JSON.stringify(req.body));

		let doc = await agentModel.findOne({ agentId: agentId }).lean();
		if (!doc) {
			logger.trace(`[${txnId}] Agent Not Found -`, agentId);
			return res.status(404).json({
				message: 'Agent Not Found'
			});
		}
		const flows = await flowModel.find({ app: req.locals.app, $or: [{ 'inputStage.options.agentId': agentId }, { 'stages.options.agentId': agentId }] }).select('_id inputStage stages').lean();
		const allFlows = [];
		flows.map(flow => {
			let agentStages = flow.stages.filter((ele) => ele.options.agentId = agentId);
			agentStages.forEach(stage => {
				allFlows.push({ flowId: flow._id, options: stage.options });
			});
			if (flow.inputStage && flow.inputStage.options && flow.inputStage.options.agentId == agentId) {
				allFlows.push({ flowId: flow._id, options: flow.inputStage.options });
			}
		});
		res.status(200).json({ result: allFlows });
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.post('/:id/heartbeat', async (req, res) => {
	try {
		const txnId = req.header('txnId');
		const agentId = req.params.id;
		logger.info(`[${txnId}] Processing Agent Init Action of -`, agentId);
		logger.trace(`[${txnId}] Agent Init Action Body -`, JSON.stringify(req.body));

		let doc = await agentModel.findOne({ agentId: agentId }).lean();
		if (!doc) {
			logger.trace(`[${txnId}] Agent Not Found -`, agentId);
			return res.status(404).json({
				message: 'Agent Not Found'
			});
		}

		const actions = [];
		const docs = await agentActionModel.find({ agentId: agentId, sentOrRead: false }).select('action metaData timestamp');
		if (docs.length > 0) {
			await Promise.all(docs.map(async (doc) => {
				actions.push(doc.toObject());
				doc.sentOrRead = true;
				doc._req = req;
				await doc.save();
			}));
		}
		res.status(200).json({ actions });

	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.get('/:id/password', async (req, res) => {
	try {
		const agentId = req.params.id;
		let doc = await agentModel.findById({ agentId: agentId }).lean();
		if (!doc) {
			return res.status(404).json({
				message: 'Agent Not Found'
			});
		}
		const result = await securityUtils.decryptText(doc.app, doc.password);
		if (!result || result.statusCode != 200) {
			return res.status(404).json({
				message: 'Unable to Decrypt Agent Password'
			});
		}
		return res.status(200).json({ password: result.body.data });
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.put('/:id/password', async (req, res) => {
	try {
		const agentId = req.params.id;
		let doc = await agentModel.findById({ agentId: agentId });
		if (!doc) {
			return res.status(404).json({
				message: 'Agent Not Found'
			});
		}
		doc.password = null;
		doc._req = req;
		let status = await doc.save();
		const actionDoc = new agentActionModel({
			agentId: doc.agentId,
			action: 'PASSWORD-CHANGED'
		});
		actionDoc._req = req;
		status = await actionDoc.save();
		status = await cacheUtils.endSession(agentId);
		logger.debug('Agent Password Change Status: ', status);
		return res.status(200).json({ message: 'Password Changed Successfully' });
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.put('/:id/re-issue', async (req, res) => {
	try {
		const agentId = req.params.id;
		let doc = await agentModel.findById({ agentId: agentId }).lean();
		if (!doc) {
			return res.status(404).json({
				message: 'Agent Not Found'
			});
		}
		const temp = JSON.parse(JSON.stringify(doc));
		delete temp.password;
		delete temp.secret;
		delete temp.status;

		const token = JWT.sign(temp, config.secret, { expiresIn: '2h' });
		await cacheUtils.endSession(agentId);
		await cacheUtils.whitelistToken(agentId, token);

		logger.debug('Agent Logged In :', doc.lastLoggedIn);
		res.status(200).json(temp);

		const actionDoc = new agentActionModel({
			agentId: doc.agentId,
			action: 'TOKEN-REISSUED',
			metaData: {
				token
			}
		});
		actionDoc._req = req;
		let status = await actionDoc.save();
		logger.debug('Agent Token Re-Issued: ', status);
		return res.status(200).json({ message: 'Agent Token Re-Issued' });
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.delete('/:id/session', async (req, res) => {
	try {
		let doc = await agentModel.findById({ agentId: req.params.id }).lean();
		if (!doc) {
			return res.status(404).json({
				message: 'Agent Not Found'
			});
		}
		const actionDoc = new agentActionModel({
			agentId: doc.agentId,
			action: 'SESSION-ENDED'
		});
		actionDoc._req = req;
		let status = await actionDoc.save();
		status = await cacheUtils.endSession(req.params.id);
		logger.debug('Agent Session Termination Triggered ', status);
		return res.status(200).json({ message: 'Agent Session Termination Triggered' });
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.put('/:id/stop', async (req, res) => {
	try {
		let doc = await agentModel.findById({ agentId: req.params.id }).lean();
		if (!doc) {
			return res.status(404).json({
				message: 'Agent Not Found'
			});
		}
		const actionDoc = new agentActionModel({
			agentId: doc.agentId,
			action: 'AGENT-STOPPED'
		});
		actionDoc._req = req;
		let status = await actionDoc.save();
		status = await cacheUtils.endSession(req.params.id);
		logger.debug('Agent Stop Triggered ', status);
		return res.status(200).json({ message: 'Agent Stop Triggered' });
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.put('/:id/update', async (req, res) => {
	try {
		let doc = await agentModel.findById({ agentId: req.params.id }).lean();
		if (!doc) {
			return res.status(404).json({
				message: 'Agent Not Found'
			});
		}
		const actionDoc = new agentActionModel({
			agentId: doc.agentId,
			action: 'AGENT-UPDATED'
		});
		actionDoc._req = req;
		let status = await actionDoc.save();
		status = await cacheUtils.endSession(req.params.id);
		logger.debug('Agent Update Triggered ', status);
		return res.status(200).json({ message: 'Agent Update Triggered' });
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

module.exports = router;