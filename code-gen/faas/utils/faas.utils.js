const request = require('request');
const config = require('../config');

const logger = global.logger;


function getErrorResponse(err, code) {
  let errResp = {};
  errResp.appName = config.dataStackAppName;
  errResp.faasId = config.dataStackFaasId;
  errResp.faasName = config.dataStackFaasName;
  errResp.message = JSON.stringify(err.message || err);
  errResp.stackTrace = JSON.stringify(err.stack || err);
  errResp.statusCode = JSON.stringify(code)
  return errResp;
}


function informPM() {
  const url = config.baseUrlPM + `/faas/${config.dataStackFaasId}/statusChange?status=Active&version=${config.dataStackFaasVersion}`;
  logger.debug('Informing PM :', url);
  request({
    url,
    method: 'put',
    headers: {
      'Content-Type': 'application/json'
    }
  }, function (err, res) {
    if (err) {
      logger.error('Unable to Inform PM', err);
      return;
    }
    if (res.statusCode >= 300 || res.statusCode < 200) {
      logger.error('Response from PM:', res.statusCode, res.body);
    } else {
      logger.info('Informed PM');
    }
  });
}


module.exports = {
  getErrorResponse,
  informPM
};
