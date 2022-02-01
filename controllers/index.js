const router = require('express').Router();


router.use('/app', require('./app.controller'));
// router.use('/:app/agent', require('./agent.controller'));
// router.use('/:app/agentRegistry', require('./agent-registry.controller'));
router.use('/:app/dataFormat', require('./data-format.controller'));
router.use('/:app/faas', require('./faas.controller'));
router.use('/:app/faas/utils', require('./faas.utils.controller'));
router.use('/:app/flow', require('./flow.controller'));
router.use('/:app/flow/utils', require('./flow.utils.controller'));
router.use('/:app/interaction', require('./interaction.controller'));
// router.use('/:app/partner', require('./partner.controller'));
router.use('/internal/health', require('./health.controller'));

module.exports = router;