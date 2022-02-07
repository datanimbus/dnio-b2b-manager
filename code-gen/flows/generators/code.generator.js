// const log4js = require('log4js');
const _ = require('lodash');

// const logger = log4js.getLogger(global.loggerName);

function tab(len) {
	let d = '';
	while (len > 0) {
		d += '  ';
		len--;
	}
	return d;
}

/**
 * 
 * @param {any} dataJson 
 */
function generateCode(dataJson) {
	const inputStage = dataJson.inputStage;
	const stages = dataJson.stages;
	let api = inputStage.incoming.path;
	let code = [];
	code.push('const router = require(\'express\').Router();');
	code.push('const log4js = require(\'log4js\');');
	code.push('');
	code.push('const stateUtils = require(\'./state.utils\');');
	code.push('const stageUtils = require(\'./stage.utils\');');
	code.push('');
	code.push('const logger = log4js.getLogger(global.loggerName);');
	code.push('');
	// TODO: Method to be fixed.
	code.push(`router.post('${api}', async function (req, res) {`);
	code.push(`${tab(1)}let txnId = req.headers['data-stack-txn-id'];`);
	code.push(`${tab(1)}let remoteTxnId = req.headers['data-stack-remote-txn-id'];`);
	code.push(`${tab(1)}let state = {};`);
	code.push(`${tab(1)}let tempResponse = req;`);
	stages.forEach((item, i) => {
		const isLast = stages.length - 1 == i;
		code.push(`${tab(1)}// ═══════════════════ ${item._id} / ${item.name} / ${item.type} ══════════════════════`);
		code.push(`${tab(1)}logger.debug(\`[\${txnId}] [\${remoteTxnId}] Invoking stage :: ${item._id} / ${item.name} / ${item.type}\`)`);
		code.push(`${tab(1)}state = stateUtils.getState(tempResponse, '${item._id}');`);
		code.push(`${tab(1)}try {`);
		code.push(`${tab(1)}    tempResponse = await stageUtils.${_.camelCase(item._id)}(req, state);`);
		code.push(`${tab(1)}    state.statusCode = tempResponse.statusCode;`);
		code.push(`${tab(1)}    state.body = tempResponse.body;`);
		code.push(`${tab(1)}    if( tempResponse.statusCode >= 400 ) {`);
		code.push(`${tab(1)}      state.status = "ERROR";`);
		code.push(`${tab(1)}      await stateUtils.upsertState(req, state);`);
		code.push(`${tab(1)}      state = stateUtils.getState(tempResponse, '${item.onError._id}');`);
		if (item.onError && item.onError.length > 0) {
			code.push(`${tab(1)}    tempResponse = await stageUtils.${_.camelCase(item.onError._id)}(req, state);`);
		} else {
			code.push(`${tab(1)}      return res.status(tempResponse.statusCode).json(tempResponse.body)`);
		}
		code.push(`${tab(1)}    }`);
		code.push(`${tab(1)}    state.status = "SUCCESS";`);
		code.push(`${tab(1)}    await stateUtils.upsertState(req, state);`);
		if (isLast) {
			code.push(`${tab(1)}    res.status(tempResponse.statusCode).json(tempResponse.body)`);
		}
		code.push(`${tab(1)}} catch (err) {`);
		code.push(`${tab(1)}    logger.error(err);`);
		code.push(`${tab(1)}    return res.status(500).json({ message: err.message });`);
		code.push(`${tab(1)}}`);
	});
	code.push('});');
	code.push('module.exports = router;');
	return code.join('\n');
}


function generateStages(dataJson) {
	const stages = dataJson.stages;
	const code = [];
	const exportsCode = [];
	code.push('const log4js = require(\'log4js\');');
	code.push('const _ = require(\'lodash\');');
	code.push('const httpClient = require(\'./http-client\');');
	code.push('');
	code.push('const logger = log4js.getLogger(global.loggerName);');
	code.push('');
	stages.forEach((stage) => {
		exportsCode.push(`module.exports.${_.camelCase(stage._id)} = ${_.camelCase(stage._id)};`);
		code.push(`async function ${_.camelCase(stage._id)}(req, state) {`);
		code.push(`logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Starting ${_.camelCase(stage._id)} Stage\`);`);
		code.push('    try {');
		if ((stage.type === 'API' || stage.type === 'FAAS') && stage.outgoing) {
			code.push('const options = {};');
			code.push(`state.url = '${stage.outgoing.url}';`);
			code.push(`state.method = '${stage.outgoing.method}';`);
			code.push(`options.url = '${stage.outgoing.url}';`);
			code.push(`options.method = '${stage.outgoing.method}';`);
			code.push(`options.headers = _.merge(state.headers,${JSON.stringify(stage.outgoing.headers)});`);
			code.push('options.json = state.body;');
			code.push('try {');
			code.push('  const tempResponse = await httpClient.request(options);');
			code.push('  if( tempResponse && tempResponse.statusCode != 200 ) {');
			code.push(`    logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Ending ${_.camelCase(stage._id)} Stage with not 200\`);`);
			code.push('    return { statusCode: tempResponse.statusCode, body: tempResponse.body, headers: tempResponse.headers };');
			code.push('  }');
			code.push(`  logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Ending ${_.camelCase(stage._id)} Stage with 200\`);`);
			code.push('  return { statusCode: tempResponse.statusCode, body: tempResponse.body, headers: tempResponse.headers };');
			code.push('} catch(err) {');
			code.push(`  logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Ending ${_.camelCase(stage._id)} Stage with Error\`);`);
			code.push('  logger.error(err);');
			code.push('  return { statusCode: 500, body: err, headers: options.headers };');
			code.push('}');
		} else if (stage.type === 'TRANSFORM' && stage.mapping) {
			code.push('const newBody = {};');
			code.push('if (Array.isArray(state.body)) {');
			code.push('  state.body.forEach( item => {');
			stage.mapping.forEach(item => {
				code.push(`    _.set(newBody, '${item.target}', _.get(item, '${item.source[0]}'));`);
			});
			code.push('  });');
			code.push('} else {');
			stage.mapping.forEach(item => {
				code.push(`_.set(newBody, '${item.target}', _.get(state.body, '${item.source[0]}'));`);
			});
			code.push('}');
			code.push('  return { statusCode: 200, body: newBody, headers: state.headers };');
		} else {
			code.push('  return { statusCode: 200, body: state.body, headers: state.headers };');
		}
		code.push('    } catch (err) {');
		code.push('        logger.error(err);');
		code.push('        return { statusCode: 500, body: err, headers: state.headers };');
		code.push('    }');
		code.push('}');
	});
	return _.concat(code, exportsCode).join('\n');
}


module.exports.generateCode = generateCode;
module.exports.generateStages = generateStages;