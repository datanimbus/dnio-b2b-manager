const log4js = require('log4js');
const _ = require('lodash');

const logger = log4js.getLogger(global.loggerName);

/**
 * 
 * @param {any[]} dataJson 
 */
async function generateCode(dataJson) {
    const code = [];
    code.push(`router.post('/', async (req, res) => {`);
    code.push(`    let tempResponse;`);
    code.push(`    let tempBody = JSON.parse(JSON.stringify(req.body));`);
    code.push(`    let tempHeaders = JSON.parse(JSON.stringify(req.headers));`);
    code.push(`    try {`);

    dataJson.forEach((item) => {
        if ((item.type === 'API' || item.type === 'FAAS') && item.outgoing) {
            code.push(`const options = {};`);
            code.push(`options.url = '${item.outgoing.url}';`);
            code.push(`options.method = '${item.outgoing.method}';`);
            code.push(`options.headers = _.merge(tempHeaders,${JSON.stringify(item.outgoing.headers)});`);
            code.push(`options.json = tempBody;`);
            code.push(`try {`);
            code.push(`  tempResponse = await httpClient.request(options);`);
            code.push(`  if(tempResponse && tempResponse.statusCode != 200) {`);
            code.push(`    return res.status(tempResponse.statusCode).json(tempResponse.body);`);
            code.push(`  }`);
            code.push(`  tempBody = tempResponse.body;`);
            code.push(`} catch(err) {`);
            code.push(`  logger.error(err);`);
            code.push(`  return res.status(500).json({`);
            code.push(`     message: err.message`);
            code.push(`  });`);
            code.push(`}`);
        } else if (item.type === 'TRANSFORM' && item.mapping) {

        } else {
            code.push(`req.pipe(res);`);
        }
    });

    code.push(`    } catch (err) {`);
    code.push(`        logger.error(err);`);
    code.push(`        res.status(500).json({`);
    code.push(`            message: err.message`);
    code.push(`        });`);
    code.push(`    }`);
    code.push(`});`);
    return code.join('\n');
}



module.exports.generateCode = generateCode;