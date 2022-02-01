const router = require('express').Router();


router.use('/app', require('./app.controller'));
// router.use('/:app/agent', paramParser, require('./agent.controller'));
// router.use('/:app/agentRegistry', paramParser, require('./agent-registry.controller'));
router.use('/:app/dataFormat', paramParser, require('./data-format.controller'));
router.use('/:app/faas', paramParser, require('./faas.controller'));
router.use('/:app/faas/utils', paramParser, require('./faas.utils.controller'));
router.use('/:app/flow', paramParser, require('./flow.controller'));
router.use('/:app/flow/utils', paramParser, require('./flow.utils.controller'));
router.use('/:app/interaction', paramParser, require('./interaction.controller'));
// router.use('/:app/partner', paramParser, require('./partner.controller'));
router.use('/internal/health', require('./health.controller'));

module.exports = router;




function paramParser(req, res, next) {
    req.locals = {};
    req.locals.app = req.params.app;
    next();
}