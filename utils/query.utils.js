const log4js = require('log4js');

const logger = log4js.getLogger(global.loggerName);

function getPaginationData(req) {
    const data = {
        skip: 0,
        count: 30,
        select: '',
        sort: ''
    };
    if (req.query.count && (+req.query.count) > 0) {
        data.count = +req.query.count;
    }
    if (req.query.page && (+req.query.page) > 0) {
        data.skip = data.count * ((+req.query.page) - 1);
    }
    if (req.query.select && req.query.select.trim()) {
        data.select = req.query.select;
    }
    if (req.query.sort && req.query.sort.trim()) {
        data.sort = req.query.sort;
    }
    return data;
}


function parseFilter(req) {
    let filter = {};
    try {
        if (req.query.filter) {
            filter = JSON.parse(req.query.filter);
        }
    } catch (e) {
        logger.error(e);
    }
    return filter;
}


module.exports.getPaginationData = getPaginationData;
module.exports.parseFilter = parseFilter;