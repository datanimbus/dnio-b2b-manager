const router = require('express').Router({ mergeParams: true });
const log4js = require('log4js');
const mongoose = require('mongoose');
const JWT = require('jsonwebtoken');
const fs = require('fs');

const config = require('../config');
const queryUtils = require('../utils/query.utils');
const securityUtils = require('../utils/security.utils');
const cacheUtils = require('../utils/cache.utils');
const helpers = require('../utils/helper');
const fileUtils = require('../utils/file.utils');
const httpClient = require('../http-client');
const FormData = require('form-data');
const { zip } = require('zip-a-folder');
const exec = require('child_process').exec;

const logger = log4js.getLogger('agent.controller');
const agentModel = mongoose.model('agent');
const agentActionModel = mongoose.model('agent-action');
const flowModel = mongoose.model('flow');

const LICENSE_FILE = './generatedAgent/LICENSE';
const README_FILE = './generatedAgent/scriptFiles/README.md';

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
			logger.error(`[${txnId}] Agent Not Found -`, agentId);
			return res.status(404).json({
				message: 'Agent Not Found'
			});
		}
		// const flows = await flowModel.find({ app: req.locals.app, $or: [{ 'inputNode.options.agentId': agentId }, { 'nodes.options.agentId': agentId }] }).select('_id inputNode nodes').lean();
		const flows = await flowModel.find({ app: req.locals.app, $or: [{ 'inputNode.options.agents': agentId }, { 'nodes.options.agents': agentId }] }).lean();
		logger.trace(`[${txnId}] Flows found - ${flows.map(_d => _d._id)}`);
		const allFlows = [];
		let newRes = [];
		let promises = flows.map(flow => {
			logger.trace(`Floe Json - ${JSON.stringify({ flow })}`);
			let action = flow.status === 'Active' ? 'start' : 'create';
			// let agentNodes = flow.nodes.filter((ele) => ele.options.agentId = agentId);
			// agentNodes.forEach(node => {
			// 	allFlows.push({ flowId: flow._id, options: node.options });
			// });
			if (flow.inputNode && flow.inputNode.options && flow.inputNode.options.agentId == agentId) {
				allFlows.push({ flowId: flow._id, options: flow.inputNode.options });
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
			logger.error(`[${txnId}] [${agentId}] Agent Not Found`);
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
		let doc = await agentModel.findById({ _id: agentId }).lean();
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

		logger.info(`[${txnId}] File ${uploadHeaders.originalFileName} for the flow ${uploadHeaders.flowName} received, uploading file to flow`);
		const doc = await flowModel.findById(uploadHeaders.flowId);
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Flow' });
		}

		const formData = new FormData();
		formData.append('file', decryptedData);
		let flowUrl = config.baseUrlBM + '/' + doc.app + '/' + doc.inputNode.options.path;
		const options = {
			url: flowUrl,
			method: 'POST',
			headers: {
				'Content-Type': 'multipart/form-data',
				'TxnId': req.header('DATA-STACK-Txn-Id'),
			},
			body: formData
		};
		const res = await httpClient.httpRequest(options);
		if (!res) {
			logger.error(`Flow ${doc.name} is down`);
			throw new Error(`Flow ${doc.name} is down`);
		}
		if (res.statusCode === 200) {
			res.status(200).json({ message: 'File Successfully Uploaded' });
		} else {
			res.status(res.statusCode).send(res.body);
		}
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

router.get('/:id/download/exec', async (req, res) => {
	try {
		let agentId = req.params.id;
		let os = req.query.os;
		let arch = req.query.arch;
		logger.info(`Processing Agent Executable Download for - ${JSON.stringify({ agentId, os, arch })}`);

		let exeFileName = `datastack-agent-${os}-${arch}`;
		if (os === 'windows') exeFileName += '.exe';
		let sentinelFileName = `datastack-sentinel-${os}-${arch}`;
		if (os === 'windows') sentinelFileName += '.exe';
		let exeFilePath = `./generatedAgent/exes/${exeFileName}`;
		let sentinelFilePath = `./generatedAgent/sentinels/${sentinelFileName}`;

		logger.debug(`File Paths - ${JSON.stringify({ exeFilePath, sentinelFilePath })}`);
		if (!fs.existsSync(exeFilePath)) {
			return res.status(400).json({ message: 'Oops! Executable not found for the selected platform.' });
		}
		if (!fs.existsSync(sentinelFilePath)) {
			return res.status(400).json({ message: 'Oops! Sentinel not found for the selected platform.' });
		}

		let _agent = await agentModel.findOne({ _id: agentId }).lean();
		if (!_agent) {
			logger.error(`[${agentId}] Agent Not Found`);
			return res.status(404).json({
				message: 'Agent Not Found'
			});
		}

		logger.trace(`Agent data - ${JSON.stringify(_agent)}`);

		let agentID = _agent.agentId;
		let agentName = _agent.name;
		let agentConfig = {
			'agent-id': agentID,
			'agent-name': agentName,
			'agent-port-number': '63859',
			'base-url': config.gwFQDN,
			'central-folder': '.',
			'heartbeat-frequency': config.hbFrequency,
			'log-level': process.env.LOG_LEVEL || 'info',
			'sentinel-port-number': '54321'
		};
		logger.trace("config initialized - ", agentConfig);
		let confStr = createConf(agentConfig);
		let baseDir = process.cwd() + '/generatedAgent/AGENT/';
		if (!fs.existsSync(baseDir)) {
			fs.mkdirSync(baseDir);
		}

		let folderName = `${baseDir}${_agent.name}_${os}_${arch}`;
		let zipFile = folderName + '.zip';
		if (fs.existsSync(zipFile)) {
			fs.unlinkSync(zipFile);
		}
		if (fs.existsSync(folderName)) {
			deleteFolderRecursive(folderName);
		}
		fs.mkdirSync(folderName);
		return generateAgentStructure(folderName, os, false)
			.then(() => {
				fs.writeFileSync(folderName + '/conf/agent.conf', confStr);
				fs.copyFileSync(exeFilePath, folderName + '/bin/' + (os == 'windows' ? 'datastack-agent.exe' : 'datastack-agent'));
				fs.copyFileSync(sentinelFilePath, folderName + '/bin/' + (os == 'windows' ? 'datastack-sentinel.exe' : 'datastack-sentinel'));
			})
			.then(_d => {
				logger.debug(`${JSON.stringify({ _d })}`);
				return zipAFolder(folderName, zipFile);
			})
			.then(() => {
				return res.status(200).download(zipFile);
			})
			.then(() => {
				logger.debug(`Removing zip and folder`);
				deleteFolderRecursive(folderName);
			})
			.catch(err => {
				logger.error(`[${req.get('TxnId')}] Error generating agent structure - ${err}`);
			});
	} catch (err) {
		logger.error(`Error downloading Agent - ${err}`);
		res.status(500).json({
			message: err.message
		});
	}
});

function createConf(config) {
	let str = '';
	Object.keys(config).forEach(_k => {
		if (config[_k] === null) str += `${_k}=\n`;
		else str += `${_k}=${config[_k]}\n`;
	});
	return str;
}


function zipAFolder(src, dest) {
	return zip(src, dest);
}

function deleteFolderRecursive(path) {
	if (fs.existsSync(path)) {
		fs.readdirSync(path).forEach(function (file) {
			var curPath = path + '/' + file;
			if (fs.lstatSync(curPath).isDirectory()) { // recurse
				deleteFolderRecursive(curPath);
			} else { // delete file
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
}

function generateAgentStructure(baseDir, os) {
	fs.mkdirSync(`${baseDir}/bin`);
	fs.mkdirSync(`${baseDir}/conf`);
	fs.mkdirSync(`${baseDir}/data`);
	fs.mkdirSync(`${baseDir}/log`);
	fs.mkdirSync(`${baseDir}/log/temp`);
	fs.copyFileSync(LICENSE_FILE, baseDir + '/LICENSE');
	fs.copyFileSync(README_FILE, baseDir + '/README.md');
	let scriptLocation = './generatedAgent/scriptFiles/' + os;
	if (!fs.existsSync(scriptLocation)) {
		throw new Error('Script files not found for ' + os);
	}

	let promises = fs.readdirSync(scriptLocation).map(file => {
		fs.copyFileSync(`${scriptLocation}/${file}`, baseDir + '/' + file);
		if (os === 'linux' || os === 'darwin') {
			return shFilePermission(baseDir + '/' + file);
		}
		return Promise.resolve();
	});
	return Promise.all(promises);
}

function shFilePermission(file) {
	let cmdStr = 'chmod +x ' + file;
	logger.debug({ cmdStr });
	let cmd = exec(cmdStr);
	return new Promise((resolve, reject) => {
		cmd.stdout.on('data', (data) => {
			logger.debug('exec data output ' + data);
		});
		cmd.stdout.on('close', (data) => {
			logger.debug('exec close output ' + data);
			resolve();
		});
		cmd.on('error', (err) => {
			logger.error('Err' + err);
			reject(err);
		});
	});
}

module.exports = router;