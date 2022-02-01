const router = require('express').Router();
const log4js = require('log4js');
const mongoose = require('mongoose');

const queryUtils = require('../utils/query.utils');
const flowCodeGen = require('../code-gen/flows');
const flowUtils = require('../utils/flow.utils');

const logger = log4js.getLogger('flow.utils.controller');
const flowModel = mongoose.model('flow');

router.put('/:id/deploy', async (req, res) => {
    try {
        
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