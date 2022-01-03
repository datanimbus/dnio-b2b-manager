const crypto = require('crypto');
const log4js = require('log4js');

const config = require('../config');
const httpClient = require('../http-client');

const logger = log4js.getLogger(global.loggerName);


function encryptText(app, data) {
    const options = {
        url: config.baseUrlSEC + `/enc/${app}/decrypt`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: { data },
        json: true
    };
    return httpClient.httpRequest(options).then(res => {
        if (!res) {
            logger.error('Security service down');
            throw new Error('Security service down');
        }
        if (res.statusCode === 200) {
            let encryptValue = res.body.data;
            let obj = {
                value: encryptValue,
                checksum: crypto.createHash('md5').update(data).digest('hex')
            };
            return obj;
        } else {
            throw new Error('Error encrypting text');
        }
    }).catch(err => {
        logger.error('Error requesting Security service');
        throw err;
    });
}


function decryptText(app, data) {
    const options = {
        url: config.baseUrlSEC + `/enc/${app}/decrypt`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: { data },
        json: true
    };
    return httpClient.httpRequest(options).then(res => {
        if (!res) {
            logger.error('Security service down');
            throw new Error('Security service down');
        }
        if (res.statusCode === 200) {
            return res.body.data;
        } else {
            throw new Error('Error decrypting text');
        }
    }).catch(err => {
        logger.error('Error requesting Security service');
        throw err;
    });
}

module.exports.encryptText = encryptText;
module.exports.decryptText = decryptText;