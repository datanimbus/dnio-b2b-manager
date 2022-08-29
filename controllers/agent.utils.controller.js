const router = require('express').Router();
const log4js = require('log4js');
const mongoose = require('mongoose');
const JWT = require('jsonwebtoken');
const fs = require('fs');

const config = require('../config');
const queryUtils = require('../utils/query.utils');
const securityUtils = require('../utils/security.utils');
const cacheUtils = require('../utils/cache.utils');
const dbUtils = require('../utils/db.utils');
const helpers = require('../utils/helper');
const fileUtils = require('../utils/file.utils');

const logger = log4js.getLogger('agent.controller');
const agentModel = mongoose.model('agent');
const agentActionModel = mongoose.model('agent-action');
const flowModel = mongoose.model('flow');

let fileIDDownloadingList = {};

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
		logger.info(`[${txnId}] Processing Agent Init Action of -`, agentId, req.locals.app);
		logger.trace(`[${txnId}] Agent Init Action Body -`, JSON.stringify(req.body));

		let doc = await agentModel.findOne({ agentId: agentId }).lean();
		if (!doc) {
			logger.trace(`[${txnId}] Agent Not Found -`, agentId);
			return res.status(404).json({
				message: 'Agent Not Found'
			});
		}
		// const flows = await flowModel.find({ app: req.locals.app, $or: [{ 'inputStage.options.agentId': agentId }, { 'stages.options.agentId': agentId }] }).select('_id inputStage stages').lean();
		const flows = await flowModel.find({ app: req.locals.app, $or: [{ 'inputStage.options.agentId': agentId }, { 'stages.options.agentId': agentId }] }).lean();
		logger.trace(`[${txnId}] Flows found - ${flows.map(_d => _d._id)}`);
		const allFlows = [];
		let newRes = [];
		let promises = flows.map(flow => {
			logger.trace(`Floe Json - ${JSON.stringify({ flow })}`);
			let action = flow.status === 'Active' ? 'start' : 'create';
			// let agentStages = flow.stages.filter((ele) => ele.options.agentId = agentId);
			// agentStages.forEach(stage => {
			// 	allFlows.push({ flowId: flow._id, options: stage.options });
			// });
			if (flow.inputStage && flow.inputStage.options && flow.inputStage.options.agentId == agentId) {
				allFlows.push({ flowId: flow._id, options: flow.inputStage.options });
			}
			return helpers.constructEvent(doc, flow, action);
		});
		await Promise.all(promises).then((_d) => {
			newRes = [].concat.apply([], _d);
			logger.debug(`[${txnId}]`, JSON.stringify({ newRes }));
			newRes = newRes.filter(_k => _k && _k.agentID == agentId);
			logger.trace(`[${txnId}] Transfer Ledger Enteries - ${JSON.stringify({ transferLedgerEntries: newRes })}`);
			res.status(200).json({ transferLedgerEntries: newRes, mode: process.env.MODE ? process.env.MODE.toUpperCase() : 'PROD' });
		});
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
		logger.info(`[${txnId}] [${agentId}] Processing Agent Init Action`);
		logger.trace(`[${txnId}] [${agentId}] Agent Init Action Body -`, JSON.stringify(req.body));

		let doc = await agentModel.findOne({ agentId: agentId }).lean();
		if (!doc) {
			logger.trace(`[${txnId}] [${agentId}] Agent Not Found`);
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
		logger.trace(`[${txnId}] [${agentId}] Agent Heartbeat Response - ${JSON.stringify({ transferLedgerEntries: actions, status: doc.status, agentMaxConcurrentUploads: process.env.maxConcurrentUploads })}`);
		res.status(200).json({ transferLedgerEntries: actions, status: doc.status, agentMaxConcurrentUploads: config.maxConcurrentUploads });
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

		const token = JWT.sign(temp, config.RBAC_JWT_KEY, { expiresIn: '2h' });
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

router.post('/:id/upload', async (req, res) => {
	try {
		const txnId = req.header('DATA-STACK-Txn-Id');
		const agentId = req.header('DATA-STACK-Agent-Id');
		logger.info(`[${txnId}] Processing Agent Upload Action of -`, agentId);

		let uploadHeaders = {
			'mirrorPath': req.header('DATA-STACK-Mirror-Directory'),
			'os': req.header('DATA-STACK-Operating-System'),
			'agentId': req.header('DATA-STACK-Agent-Id'),
			'appName': req.header('DATA-STACK-App-Name'),
			'flowName': req.header('DATA-STACK-Flow-Name'),
			'flowId': req.header('DATA-STACK-Flow-Id'),
			'checksum': req.header('DATA-STACK-File-Checksum'),
			'originalFileName': req.header('DATA-STACK-Original-File-Name'),
			'newLocation': req.header('DATA-STACK-New-File-Location'),
			'newFileName': req.header('DATA-STACK-New-File-Name'),
			'remoteTxnId': req.header('DATA-STACK-Remote-Txn-Id'),
			'datastackTxnId': req.header('DATA-STACK-Txn-Id'),
			'deploymentName': req.header('DATA-STACK-Deployment-Name'),
			'symmetricKey': req.header('DATA-STACK-Symmetric-Key'),
			'totalChunks': req.header('DATA-STACK-Total-Chunks'),
			'currentChunk': req.header('DATA-STACK-Current-Chunk'),
			'uniqueId': req.header('DATA-STACK-Unique-ID'),
			'bufferedEncryption': req.header('DATA-STACK-BufferEncryption'),
			'agentRelease': req.header('DATA-STACK-Agent-Release'),
			'chunkChecksum': req.header('DATA-STACK-Chunk-Checksum'),
			'fileSize': req.header('DATA-STACK-File-Size'),
			'delete': true,
			'compression': req.header('DATA-STACK-Compression'),
			'datastackFileToken': req.header('DATA-STACK-File-Token')
		};
		logger.debug('upload headers - ', JSON.stringify(uploadHeaders));

		uploadHeaders.newLocation = uploadHeaders.newLocation.replace('\\', '\\\\');

		if (!req.files || Object.keys(req.files).length === 0) {
			return res.status(400).send('No files were uploaded');
		}
		const reqFile = req.files.file;
		logger.debug('Request file info - ', reqFile);
		const encryptedData = fs.readFileSync(reqFile.tempFilePath, 'utf8');
		logger.debug('encryptedData - ', encryptedData.toString());

		const decryptedData = fileUtils.decryptData(encryptedData, uploadHeaders.symmetricKey);
		logger.debug('decryptedData - ', decryptedData);

		// if (uploadHeaders.totalChunks === uploadHeaders.currentChunk) {
		// 	logger.info(`[${txnId}] All Chunks of file ${uploadHeaders.originalFileName} of flow ${uploadHeaders.flowName} received, uploading file to flow`);
		// 	const doc = await flowModel.findById(uploadHeaders.flowId);
		// 	if (!doc) {
		// 		return res.status(400).json({ message: 'Invalid Flow' });
		// 	}
		// 	if (doc.isBinary) {
		// 		dbUtils.uploadFiletoDB(uploadHeaders, encryptedData);
		// 	}
		// } else {
		// 	return res.status(200).json({ message: 'Chunk Successfully Uploaded' });
		// }
		res.status(200).json({ message: 'Chunk Successfully Uploaded' });
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

router.post('/:id/download', async (req, res) => {
	try {
		const txnId = req.header('DATA-STACK-Txn-Id');
		const agentId = req.header('DATA-STACK-Agent-Id');
		logger.info(`[${txnId}] Processing Agent Download Action of -`, agentId);

		const fileId = req.header('DATA-STACK-Agent-File-Id');
		if (fileIDDownloadingList[fileId] === true) {
			return res.status(400).json({ message: "File is already downloading" });
		} else {
			const payload = req.body;
			logger.info(`[${txnId}] payload -`, JSON.stringify(payload));

			if (req.header('DATA-STACK-BufferEncryption') != "true") {
				//GetCompleteFileFromDB
			} else {
				//getFileChunkFromDB
			}
		}
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});

module.exports = router;