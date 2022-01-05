const config = require('../config');
const httpClient = require('../http-client');

const logger = global.logger;

async function getApp(req, _id) {
    try {
        const res = await httpClient.httpRequest({
            url: config.baseUrlUSR + '/app/' + app + '?select=_id',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'TxnId': req.headers['TxnId'],
                'Authorization': req.headers['Authorization']
            }
        });
        return res;
    } catch (err) {
        logger.error(err);
        return { statusCode: 500, body: err };
    }
}

function countAttr(def) {
    let count = 0;
    if (def && Array.isArray(def)) {
        def.forEach(_d => {
            if (_d && _d.type === 'Object') {
                count += countAttr(_d.definition);
            } else {
                count++;
            }
        });
        return count;
    } else {
        return count;
    }
}

module.exports.getApp = getApp;
module.exports.countAttr = countAttr;