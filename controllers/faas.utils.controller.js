const router = require('express').Router();
const log4js = require('log4js');
const mongoose = require('mongoose');

const queryUtils = require('../utils/query.utils');
const deployUtils = require('../utils/deploy.utils');
const codeGen = require('../code-gen/faas');

const logger = log4js.getLogger('faas.controller');
const faasModel = mongoose.model('faas');

router.get('/count', async (req, res) => {
	try {
		const filter = queryUtils.parseFilter(req.query.filter);
		if (filter) {
			filter.app = req.locals.app;
		}
		const count = await faasModel.countDocuments(filter);
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
		const doc = await faasModel.findById(req.params.id);
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Function' });
		}
		doc.status = 'Active';
		doc._req = req;
		await doc.save();
		res.status(200).json({ message: 'Function Status Updated' });
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
		const doc = await faasModel.findById(req.params.id).lean();
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Function' });
		}
		await codeGen.createProject(doc, req.header('txnId'));
		const status = await deployUtils.deploy(doc, 'faas');
		if (status.statusCode !== 200 || status.statusCode !== 202) {
			return res.status(status.statusCode).json({ message: 'Unable to deploy function' });
		}
		res.status(200).json({ message: 'Function Deployed' });
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
		const doc = await faasModel.findById(req.params.id).lean();
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Function' });
		}
		await codeGen.createProject(doc, req.header('txnId'));
		const status = await deployUtils.repair(doc, 'faas');
		if (status.statusCode !== 200 || status.statusCode !== 202) {
			return res.status(status.statusCode).json({ message: 'Unable to repair function' });
		}
		res.status(200).json({ message: 'Function Repaired' });
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
		const doc = await faasModel.findById(req.params.id).lean();
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Function' });
		}
		const status = await deployUtils.start(doc);
		if (status.statusCode !== 200 || status.statusCode !== 202) {
			return res.status(status.statusCode).json({ message: 'Unable to start function' });
		}
		res.status(200).json({ message: 'Function Started' });
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
	try {
		const doc = await faasModel.findById(req.params.id);
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Function' });
		}
		const status = await deployUtils.stop(doc);
		if (status.statusCode !== 200 || status.statusCode !== 202) {
			return res.status(status.statusCode).json({ message: 'Unable to stop Function' });
		}
		doc.status = 'Stopped';
		doc._req = req;
		await doc.save();
		res.status(200).json({ message: 'Function Stopped' });
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

router.put('/:id/statusChange', async (req, res) => {
	let id = req.params.id;
	let status = req.query.status;
	let socket = req.app.get('socket');

	logger.info(`[${req.get('TxnId')}] Faas status update params - ${JSON.stringify({ id, status })}`);
	try {
		const doc = await faasModel.findById(id);
		if (!doc) {
			return res.status(400).json({ message: 'Invalid Function' });
		}

		doc.status = status;

		if (doc._metadata && doc._metadata.lastUpdated) doc._metadata.lastUpdated = new Date();

		doc._req = req;
		await doc.save();

		logger.debug(`[${req.get('TxnId')}] Emitting socket event - ${JSON.stringify({ _id: id, app: doc.app, message: status })}`);
		socket.emit('faasStatus', {
			_id: id,
			app: doc.app,
			message: status
		});

		res.status(200).json({ message: 'Status Updated' });
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