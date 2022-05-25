const router = require('express').Router();
const log4js = require('log4js');
const mongoose = require('mongoose');

// const codeGen = require('../code-gen/flows');
// const deployUtils = require('../utils/deploy.utils');
const k8sUtils = require('../utils/k8s.utils');
const queryUtils = require('../utils/query.utils');
const routerUtils = require('../utils/router.utils');
const config = require('../config');

const logger = log4js.getLogger('flow.utils.controller');
const flowModel = mongoose.model('flow');

let dockerRegistryType = process.env.DOCKER_REGISTRY_TYPE ? process.env.DOCKER_REGISTRY_TYPE : '';
if (dockerRegistryType.length > 0) dockerRegistryType = dockerRegistryType.toUpperCase();

let dockerReg = process.env.DOCKER_REGISTRY_SERVER ? process.env.DOCKER_REGISTRY_SERVER : '';
if (dockerReg.length > 0 && !dockerReg.endsWith('/') && dockerRegistryType != 'ECR') dockerReg += '/';
let flowBaseImage = `${dockerReg}data.stack.b2b.base:${config.imageTag}`;
if (dockerRegistryType == 'ECR') flowBaseImage = `${dockerReg}:data.stack.b2b.base:${config.imageTag}`;

router.get('/count', async (req, res) => {
	try {
		const filter = queryUtils.parseFilter(req.query.filter);
		if (filter) {
			filter.app = req.locals.app;
		}
		const count = await flowModel.countDocuments(filter);
		return res.status(200).json(count);
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


router.put('/:id/init', async (req, res) => {
	try {
		const doc = await flowModel.findById(req.params.id);
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Flow' });
		}
		doc.status = 'Active';
		doc.isNew = false;
		doc._req = req;
		await doc.save();
		res.status(200).json({ message: 'Flow Status Updated' });
		routerUtils.initRouterMap();
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

router.put('/:id/deploy', async (req, res) => {
	try {
		const doc = await flowModel.findById(req.params.id).lean();
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Flow' });
		}
		// await codeGen.createProject(doc);
		if (config.isK8sEnv() && !doc.isBinary) {
			// const status = await deployUtils.deploy(doc, 'flow');
			doc.image = flowBaseImage;
			let status = await k8sUtils.upsertService(doc);
			status = await k8sUtils.upsertDeployment(doc);
			logger.info('Deploy API called');
			logger.debug(status);
			if (status.statusCode != 200 && status.statusCode != 202) {
				return res.status(status.statusCode).json({ message: 'Unable to deploy Flow' });
			}
		}
		doc.status = 'Pending';
		doc.isNew = false;
		res.status(200).json({ message: 'Flow Deployed' });
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

router.put('/:id/repair', async (req, res) => {
	try {
		const doc = await flowModel.findById(req.params.id).lean();
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Flow' });
		}
		// await codeGen.createProject(doc, req.header('txnId'));
		if (config.isK8sEnv()) {
			// const status = await deployUtils.repair(doc, 'flow');
			doc.image = flowBaseImage;
			let status = await k8sUtils.deleteDeployment(doc);
			status = await k8sUtils.deleteService(doc);
			status = await k8sUtils.upsertService(doc);
			status = await k8sUtils.upsertDeployment(doc);
			logger.info('Repair API called');
			logger.debug(status);
			if (status.statusCode !== 200 && status.statusCode !== 202) {
				return res.status(status.statusCode).json({ message: 'Unable to repair Flow' });
			}
		}
		doc.status = 'Pending';
		doc.isNew = false;
		doc._req = req;
		res.status(200).json({ message: 'Flow Repaired' });
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

router.put('/:id/start', async (req, res) => {
	try {
		const doc = await flowModel.findById(req.params.id).lean();
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Flow' });
		}
		if (config.isK8sEnv() && !doc.isBinary) {
			// const status = await deployUtils.start(doc);
			const status = await k8sUtils.scaleDeployment(doc, 1);
			logger.info('Start API called');
			logger.debug(status);
			if (status.statusCode !== 200 && status.statusCode !== 202) {
				return res.status(status.statusCode).json({ message: 'Unable to start Flow' });
			}
		}
		doc.status = 'Pending';
		doc.isNew = false;
		doc._req = req;
		res.status(200).json({ message: 'Flow Started' });
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

router.put('/:id/stop', async (req, res) => {
	logger.info(`Flow stop request :: ${req.params.id}`);
	try {
		const doc = await flowModel.findById(req.params.id);
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Flow' });
		}
		if (config.isK8sEnv() && !doc.isBinary) {
			// const status = await deployUtils.stop(doc);
			const status = await k8sUtils.scaleDeployment(doc, 0);
			logger.info('Stop API called');
			logger.debug(status);
			if (status.statusCode !== 200 && status.statusCode !== 202) {
				logger.error('K8S :: Error stopping flow');
				return res.status(status.statusCode).json({ message: 'Unable to stop Flow' });
			}
		}
		doc.status = 'Stopped';
		doc.isNew = false;
		doc._req = req;
		await doc.save();
		res.status(200).json({ message: 'Flow Stopped' });
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