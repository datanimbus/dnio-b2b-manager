const got = require('got');
const sh = require('shorthash');
const crypto = require('crypto');
/**
 * @typedef {Object} QueryParams
 * @property {string} [select]
 * @property {string} [sort]
 * @property {number} [page]
 * @property {number} [count]
 * @property {string} filter
 */

/**
 * @typedef {Object} Options
 * @property {string} url
 * @property {string} [method=get]
 * @property {*} body
 * @property {*} formdata
 * @property {*} headers
 * @property {number} timeout
 * @property {boolean} insecure
 * @property {boolean} rejectUnauthorized
 * @property {QueryParams} qs
 */

/**
 * 
 * @param {Options} options 
 */
async function httpRequest(options) {
    try {
        if (!options) {
            options = {};
        }
        if (!options.method) {
            options.method = 'GET';
        }
        options.responseType = 'json';
        if (!options['headers']) {
            options['headers'] = {};
        }
        if (!options['headers']['TxnId']) {
            options['headers']['TxnId'] = `${sh.unique(crypto.createHash('md5').update(Date.now().toString()).digest('hex'))}`;
        }
        if (!options['headers']['Content-Type']) {
            options['headers']['Content-Type'] = `application/json`;
        }
        const resp = await got(options);
        return { statusCode: resp.statusCode, body: resp.body };
    } catch (err) {
        if (err.response) {
            throw { statusCode: err.response.statusCode, body: err.response.body };
        } else {
            throw { statusCode: 500, body: err };
        }
    }
}

module.exports.httpRequest = httpRequest;