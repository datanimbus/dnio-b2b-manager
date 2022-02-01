const router = require('express').Router();
const log4js = require('log4js');
const mongoose = require('mongoose');

const queryUtils = require('../utils/query.utils');

const logger = log4js.getLogger('faas.controller');
const faasModel = mongoose.model('faas');


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

module.exports = router;