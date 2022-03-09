const router = require('express').Router();

const logger = global.logger;


router.get('/health/ready', (req, res) => {
  logger.trace('Readiness Check');
  if (global.dataDB) {
    global.dataDB.listCollections().toArray().then(status => {
      res.status(200).end();
    }).catch(err => {
      logger.error(err);
      res.status(400).end();
    });
  } else {
    res.status(400).end();
  }
});

router.get('/health/live', (req, res) => {
  logger.trace('Liveness Check');
  res.status(200).end();
});



module.exports = router;
