const log4js = require('log4js');
const _ = require('lodash');

const logger = log4js.getLogger(global.loggerName);

/**
 * 
 * @param {any[]} dataJson 
 */
function generateCode(dataJson) {
    let code = [];
    code.push(`const router = require('express').Router();`);
    code.push(``);
    code.push(`const stateUtils = require('./state.utils');`);
    code.push(`const stageUtils = require('./stage.utils');`);
    code.push(``);
    code.push(``);
    code.push(`router.use('/', async function (req, res) {`);
    code.push(`let state = {};`);
    code.push(`let tempResponse = req;`);
    dataJson.forEach((item) => {
        code.push(`state = stateUtils.getState(tempResponse, '${item._id}');`);
        code.push(`try {`);
        code.push(`    tempResponse = await stageUtils.${_.camelCase(item._id)}(req, state);`);
        code.push(`    state.statusCode = tempResponse.statusCode;`);
        code.push(`    state.body = tempResponse.body;`);
        code.push(`    if( tempResponse.statusCode != 200 ) {`);
        code.push(`         return res.status(tempResponse.statusCode).json(tempResponse.body)`);
        code.push(`    }`);
        code.push(`} catch (err) {`);
        code.push(`    logger.error(err);`);
        code.push(`    return res.status(500).json({ message: err.message });`);
        code.push(`} finally {`);
        code.push(`     stateUtils.upsertState(req, state);`);
        code.push(`}`);
    });
    code.push(`});`);
    code.push(`module.exports = router;`);
    return code.join('\n');
}


function generateStages(dataJson) {
    const code = [];
    const exportsCode = [];
    code.push(`const log4js = require('log4js');`);
    code.push(`const _ = require('lodash');`);
    code.push(`const httpClient = require('./http-client');`);
    code.push(``);
    code.push(`const logger = log4js.getLogger();`);
    code.push(``);
    dataJson.forEach((item) => {
        exportsCode.push(`module.exports.${_.camelCase(item._id)} = ${_.camelCase(item._id)};`);
        code.push(`async function ${_.camelCase(item._id)}(req, state) {`);
        code.push(`logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Starting ${_.camelCase(item._id)} Stage\`);`);
        code.push(`    const options = {};`);
        code.push(`    try {`);
        if ((item.type === 'API' || item.type === 'FAAS') && item.outgoing) {
            code.push(`state.url = '${item.outgoing.url}';`);
            code.push(`state.method = '${item.outgoing.method}';`);
            code.push(`options.url = '${item.outgoing.url}';`);
            code.push(`options.method = '${item.outgoing.method}';`);
            code.push(`options.headers = _.merge(state.headers,${JSON.stringify(item.outgoing.headers)});`);
            code.push(`options.json = state.body;`);
            code.push(`try {`);
            code.push(`  const tempResponse = await httpClient.request(options);`);
            code.push(`  if( tempResponse && tempResponse.statusCode != 200 ) {`);
            code.push(`    logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Ending ${_.camelCase(item._id)} Stage with not 200\`);`);
            code.push(`    return res.status(tempResponse.statusCode).json(tempResponse.body);`);
            code.push(`  }`);
            code.push(`  logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Ending ${_.camelCase(item._id)} Stage with 200\`);`);
            code.push(`  return { statusCode: tempResponse.statusCode, body: tempResponse.body, headers: tempResponse.headers };`);
            code.push(`} catch(err) {`);
            code.push(`  logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Ending ${_.camelCase(item._id)} Stage with Error\`);`);
            code.push(`  logger.error(err);`);
            code.push(`  return { statusCode: 500, body: err, headers: options.headers };`);
            code.push(`}`);
        } else if (item.type === 'TRANSFORM' && item.mapping) {
            
        } else {
            code.push(`  return { statusCode: 200, body: stage.body, headers: stage.headers };`);
        }
        code.push(`    } catch (err) {`);
        code.push(`        logger.error(err);`);
        code.push(`        return { statusCode: 500, body: err, headers: options.headers };`);
        code.push(`    }`);
        code.push(`}`);
    });
    return _.concat(code, exportsCode).join('\n');
}


module.exports.generateCode = generateCode;
module.exports.generateStages = generateStages;