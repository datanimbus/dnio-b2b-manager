const log4js = require('log4js');
const router = require('express').Router();

const routerUtils = require('./utils/router.utils');

const logger = log4js.getLogger(global.loggerName);
routerUtils.initRouterMap();

router.use(async (req, res) => {
    try {
        const path = req.path;
    } catch (err) {
        logger.error(err);
        res.status(500).json({ message: err.message });
    }
});


module.exports = router;