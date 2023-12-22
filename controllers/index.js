const router = require('express').Router({ mergeParams: true });
const log4js = require('log4js');
const mongoose = require('mongoose');

const queryUtils = require('../utils/query.utils');

const logger = log4js.getLogger(global.loggerName);
const faasModel = mongoose.model('faas');

router.get('/faas/fetchAll', async (req, res) => {
	try {
		const filter = queryUtils.parseFilter(req.query.filter);
		if (req.query.countOnly) {
			const count = await faasModel.countDocuments(filter);
			return res.status(200).json(count);
		}
		const data = queryUtils.getPaginationData(req);
		const docs = await faasModel.find(filter).select(data.select).sort(data.sort).skip(data.skip).limit(data.count).lean();
		logger.trace('Fetch All Functions :: ', JSON.stringify(docs));
		res.status(200).json(docs);
	} catch (err) {
		logger.error(err);
		res.status(500).json({
			message: err.message
		});
	}
});
router.use('/auth', paramParser, require('./agent-auth.controller'));
router.use('/app', require('./app.controller'));
router.use('/:app/node', paramParser, require('./custom-node.controller'));
router.use('/:app/plugin', paramParser, require('./custom-node.controller'));
// router.use('/:app/node/utils', paramParser, require('./custom-node.utils.controller'));
router.use('/:app/agent', paramParser, require('./agent.controller'));
router.use('/:app/agent/utils', paramParser, require('./agent-session.controller'));
router.use('/:app/agent/utils', paramParser, require('./agent.utils.controller'));
router.use('/:app/dataFormat', paramParser, require('./data-format.controller'));
router.use('/:app/faas', paramParser, require('./faas.controller'));
router.use('/:app/faas/utils', paramParser, require('./faas.utils.controller'));
router.use('/:app/flow', paramParser, require('./flow.controller'));
router.use('/:app/flow/utils', paramParser, require('./flow.utils.controller'));
router.use('/:app/interaction', paramParser, require('./interaction.controller'));
// router.use('/:app/node', paramParser, require('./custom-node.controller'));
router.use('/internal', require('./internal.controller'));
router.use('/internal/health', require('./health.controller'));

module.exports = router;




function paramParser(req, res, next) {
	req.locals = {};
	req.locals.app = req.params.app;
	next();
}