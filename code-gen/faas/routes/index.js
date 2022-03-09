const router = require('express').Router();


router.use('/', require('./faas.router'));
router.use('/utils', require('./utils.router'));


module.exports = router;
