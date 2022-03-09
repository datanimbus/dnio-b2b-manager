// const log4js = require('log4js');
const _ = require('lodash');
const { v4: uuid } = require('uuid');
const config = require('../config');

// const logger = log4js.getLogger(global.loggerName);

const visitedStages = [];

function tab(len) {
	let d = '';
	while (len > 0) {
		d += '    ';
		len--;
	}
	return d;
}

/**
 * 
 * @param {any} dataJson 
 */
function parseFlow(dataJson) {
	const inputStage = dataJson.inputStage;
	const stages = dataJson.stages;
	let api = inputStage.options.path;
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
	code.push(`${tab(1)}let response = req;`);
	code.push(`${tab(1)}let state = stateUtils.getState(response, '${inputStage._id}');`);
	code.push(`${tab(1)}let stage = {};`);
	code.push(`${tab(1)}stage['${inputStage._id}'] = state;`);
	code.push(`${tab(1)}let isResponseSent = false;`);
	inputStage.onSuccess.map(ss => {
		const stageCondition = ss.condition;
		const temp = stages.find(e => e._id === ss._id);
		temp.condition = stageCondition;
		return temp;
	}).forEach((stage, i) => {
		if (visitedStages.indexOf(stage._id) > -1) {
			return;
		}
		visitedStages.push(stage._id);
		if (stage.condition) code.push(`${tab(1)}if (${stage.condition}) {`);
		code = code.concat(generateCode(stage, stages));
		if (stage.condition) code.push(`${tab(1)}}`);
	});
	code.push(`${tab(1)}return isResponseSent ? true : res.status(response.statusCode).json(response.body)`);
	code.push('});');
	code.push('module.exports = router;');
	return code.join('\n');
}

/**
 * 
 * @param {any} dataJson 
 */
function generateCode(stage, stages) {
	let code = [];
	code.push(`${tab(1)}// ═══════════════════ ${stage._id} / ${stage.name} / ${stage.type} ══════════════════════`);
	code.push(`${tab(1)}logger.debug(\`[\${txnId}] [\${remoteTxnId}] Invoking stage :: ${stage._id} / ${stage.name} / ${stage.type}\`)`);
	code.push(`${tab(1)}try {`);
	if (stage.type === 'RESPONSE') {
		code.push(`${tab(2)}isResponseSent = true;`);
		code.push(`${tab(2)}res.status(response.statusCode).json(response.body)`);
	} else {
		code.push(`${tab(2)}state = stateUtils.getState(response, '${stage._id}');`);
		code.push(`${tab(2)}response = await stageUtils.${_.camelCase(stage._id)}(req, state, stage);`);
		code.push(`${tab(2)}if (response.statusCode >= 400) {`);
		if (stage.onError && stage.onError.length > 0) {
			code.push(`${tab(3)}state = stateUtils.getState(response, '${stage.onError[0]._id}');`);
			code.push(`${tab(3)}await stageUtils.${_.camelCase(stage.onError[0]._id)}(req, state, stage);`);
		} else {
			code.push(`${tab(3)}return isResponseSent ? true : res.status(response.statusCode).json(response.body)`);
		}
		code.push(`${tab(2)}}`);
	}
	code.push(`${tab(1)}} catch (err) {`);
	code.push(`${tab(2)}logger.error(err);`);
	code.push(`${tab(2)}return isResponseSent ? true : res.status(500).json({ message: err.message });`);
	code.push(`${tab(1)}}`);
	stage.onSuccess.map(ss => {
		const stageCondition = ss.condition;
		const temp = stages.find(e => e._id === ss._id);
		temp.condition = stageCondition;
		return temp;
	}).forEach((stage, i) => {
		if (visitedStages.indexOf(stage._id) > -1) {
			return;
		}
		visitedStages.push(stage._id);
		if (stage.condition) code.push(`${tab(1)}if (${stage.condition}) {`);
		code = code.concat(generateCode(stage, stages));
		if (stage.condition) code.push(`${tab(1)}}`);
	});
	return code.join('\n');
}

function parseStages(dataJson) {
	const code = [];
	code.push('const log4js = require(\'log4js\');');
	code.push('const _ = require(\'lodash\');');
	code.push('const httpClient = require(\'./http-client\');');
	code.push('const commonUtils = require(\'./common.utils\');');
	code.push('const stateUtils = require(\'./state.utils\');');
	code.push('');
	code.push('const logger = log4js.getLogger(global.loggerName);');
	code.push('');
	return _.concat(code, generateStages(dataJson)).join('\n');
}


function generateStages(stage) {
	const stages = stage.stages;
	let code = [];
	const exportsCode = [];
	let loopCode = [];
	stages.forEach((stage) => {
		exportsCode.push(`module.exports.${_.camelCase(stage._id)} = ${_.camelCase(stage._id)};`);
		code.push(`async function ${_.camelCase(stage._id)}(req, state, stage) {`);
		code.push(`${tab(1)}logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Starting ${_.camelCase(stage._id)} Stage\`);`);
		code.push(`${tab(1)}try {`);
		if (stage.type === 'API' || stage.type === 'DATASERVICE' || stage.type === 'FAAS' || stage.type === 'AUTH-DATASTACK') {
			code.push(`${tab(2)}const options = {};`);
			code.push(`${tab(2)}let customHeaders = {};`);
			code.push(`${tab(2)}let customBody = state.body;`);
			if (stage.type === 'API' && stage.options) {
				code.push(`${tab(2)}state.url = '${stage.options.host}${stage.options.path}';`);
				code.push(`${tab(2)}state.method = '${stage.options.method}';`);
				code.push(`${tab(2)}options.url = state.url;`);
				code.push(`${tab(2)}options.method = state.method;`);
				code.push(`${tab(2)}customHeaders = JSON.parse(\`${parseHeaders(stage.options.headers)}\`);`);
				if (stage.options.body && !_.isEmpty(stage.options.body)) {
					code.push(`${tab(2)}customBody = JSON.parse(\`${parseBody(stage.options.body)}\`);`);
				}
			} else if (stage.type === 'DATASERVICE') {
				code.push(`${tab(2)}const dataService = await commonUtils.getDataService('${stage.options._id}');`);
				code.push(`${tab(2)}state.url = 'http://' + dataService.collectionName.toLowerCase() + '.' + '${config.DATA_STACK_NAMESPACE}' + '-' + dataService.app.toLowerCase() + '/' + dataService.app + dataService.api`);
				code.push(`${tab(2)}state.method = '${stage.options.method}';`);
				code.push(`${tab(2)}options.url = state.url;`);
				code.push(`${tab(2)}options.method = state.method;`);
				code.push(`${tab(2)}customHeaders = JSON.parse(\`${parseHeaders(stage.options.headers)}\`);`);
				if (stage.options.body && !_.isEmpty(stage.options.body)) {
					code.push(`${tab(2)}customBody = JSON.parse(\`${parseBody(stage.options.body)}\`);`);
				}
			} else if (stage.type === 'FAAS') {
				code.push(`${tab(2)}const faas = await commonUtils.getFaaS('${stage.options._id}');`);
				code.push(`${tab(2)}state.url = '${config.baseUrlBM}/faas/' + faas.app + faas.api`);
				code.push(`${tab(2)}state.method = '${stage.options.method}';`);
				code.push(`${tab(2)}options.url = state.url;`);
				code.push(`${tab(2)}options.method = state.method;`);
				code.push(`${tab(2)}customHeaders = JSON.parse(\`${parseHeaders(stage.options.headers)}\`);`);
				if (stage.options.body && !_.isEmpty(stage.options.body)) {
					code.push(`${tab(2)}customBody = JSON.parse(\`${parseBody(stage.options.body)}\`);`);
				}
			} else if (stage.type === 'AUTH-DATASTACK') {
				code.push(`${tab(2)}const password = '${stage.options.password}'`);
				code.push(`${tab(2)}state.url = '${config.baseUrlUSR}/login'`);
				code.push(`${tab(2)}state.method = 'POST';`);
				code.push(`${tab(2)}options.url = state.url;`);
				code.push(`${tab(2)}options.method = state.method;`);
				code.push(`${tab(2)}customHeaders = state.headers;`);
				code.push(`${tab(2)}customBody = { username: '${stage.options.username}', password: '${stage.options.password}' };`);
			}
			code.push(`${tab(2)}options.headers = _.merge(state.headers, customHeaders);`);
			code.push(`${tab(2)}options.json = customBody;`);
			code.push(`${tab(2)}const response = await httpClient.request(options);`);
			code.push(`${tab(2)}state.statusCode = response.statusCode;`);
			code.push(`${tab(2)}state.body = response.body;`);
			code.push(`${tab(2)}state.headers = response.headers;`);
			code.push(`${tab(2)}if (response && response.statusCode != 200) {`);
			code.push(`${tab(3)}state.status = "ERROR";`);
			code.push(`${tab(3)}logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Ending ${_.camelCase(stage._id)} Stage with not 200\`);`);
			code.push(`${tab(3)}return { statusCode: response.statusCode, body: response.body, headers: response.headers };`);
			code.push(`${tab(2)}}`);
			code.push(`${tab(2)}state.status = "SUCCESS";`);
			code.push(`${tab(2)}logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Ending ${_.camelCase(stage._id)} Stage with 200\`);`);
			code.push(`${tab(2)}return { statusCode: response.statusCode, body: response.body, headers: response.headers };`);
		} else if ((stage.type === 'TRANSFORM' || stage.type === 'MAPPING') && stage.mapping) {
			code.push(`${tab(2)}const newBody = {};`);
			stage.mapping.forEach(mappingData => {
				const formulaCode = [];
				const formulaID = 'formula_' + _.camelCase(uuid());
				mappingData.formulaID = formulaID;
				formulaCode.push(`function ${formulaID}(data) {`);
				mappingData.source.forEach((source, i) => {
					formulaCode.push(`let input${i + 1} =  _.get(data, '${source.dataPath}');`);
				});
				if (mappingData.formula) {
					formulaCode.push(mappingData.formula);
				} else if (mappingData.source && mappingData.source.length > 0) {
					formulaCode.push('return input1;');
				}
				formulaCode.push('}');
				code.push(formulaCode.join('\n'));
			});
			code.push(`${tab(2)}if (Array.isArray(state.body)) {`);
			code.push(`${tab(3)}state.body.forEach(item => {`);
			stage.mapping.forEach(mappingData => {
				code.push(`${tab(4)}_.set(newBody, '${mappingData.target.dataPath}', ${mappingData.formulaID}(item));`);
			});
			code.push(`${tab(3)}});`);
			code.push(`${tab(2)}} else {`);
			stage.mapping.forEach(mappingData => {
				code.push(`${tab(3)}_.set(newBody, '${mappingData.target.dataPath}', ${mappingData.formulaID}(state.body));`);
			});
			code.push(`${tab(2)}}`);
			code.push(`${tab(2)}return { statusCode: 200, body: newBody, headers: state.headers };`);
		} else if (stage.type === 'FLOW') {
			if (stage.parallel && stage.parallel.length > 0) {
				code.push(`${tab(2)}let promiseArray = [];`);
				stage.parallel.forEach(flow => {
					code.push(`${tab(2)}promiseArray.push(callFlow('${flow._id}', state))`);
				});
				code.push(`${tab(2)}const promises = await Promise.all(promiseArray)`);
				code.push(`${tab(2)}const allBody = promises.map(e=>e.body)`);
				code.push(`${tab(2)}const allHeaders = promises.reduce((prev,curr)=>_.merge(prev,curr.headers),{})`);
				code.push(`${tab(2)}return { statusCode: 200, body: allBody, headers: allHeaders };`);
			} else if (stage.sequence && stage.sequence.length > 0) {
				code.push(`${tab(2)}let response = state;`);
				stage.sequence.forEach(flow => {
					code.push(`${tab(2)}response = await callFlow('${flow._id}', response)`);
					code.push(`${tab(2)}if( response && response.statusCode != 200 ) {`);
					code.push(`${tab(3)}logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Ending ${_.camelCase(stage._id)} Stage with not 200\`);`);
					code.push(`${tab(3)}return { statusCode: response.statusCode, body: response.body, headers: response.headers };`);
					code.push(`${tab(2)}}`);
				});
			}
		} else if (stage.type === 'FOREACH' || stage.type === 'REDUCE') {
			loopCode = generateStages(stage);
			code.push(`${tab(2)}let temp = JSON.parse(JSON.stringify(state.body));`);
			code.push(`${tab(2)}if (!Array.isArray(temp)) {`);
			code.push(`${tab(3)}temp = [temp]`);
			code.push(`${tab(2)}}`);
			if (stage.type === 'FOREACH') {
				code.push(`${tab(2)}promises = temp.map(async(data) => {`);
				code.push(`${tab(2)}let response = { headers: state.headers, body: data };`);
				stage.stages.forEach((st, si) => {
					code.push(`${tab(2)}state = stateUtils.getState(response, '${st._id}', true);`);
					code.push(`${tab(2)}response = await ${_.camelCase(st._id)}(req, state, stage);`);
					code.push(`${tab(2)}if (response.statusCode >= 400) {`);
					if (st.onError && st.onError.length > 0) {
						code.push(`${tab(3)}state = stateUtils.getState(response, '${st.onError[0]._id}', true);`);
						code.push(`${tab(3)}await ${_.camelCase(st.onError[0]._id)}(req, state, stage);`);
					} else {
						code.push(`${tab(3)}return { statusCode: response.statusCode, body: response.body, headers: response.headers };`);
					}
					code.push(`${tab(2)}}`);
					if (stage.stages.length - 1 === si) {
						code.push(`${tab(3)}return { statusCode: response.statusCode, body: response.body, headers: response.headers };`);
					}
				});
				code.push(`${tab(2)}});`);
				code.push(`${tab(2)}promises = await Promise.all(promises);`);
				code.push(`${tab(2)}return { statusCode: 200, body: promises.map(e=>e.body), headers: state.headers };`);
			} else {
				// code.push(`${tab(2)}promises = await temp.reduce(async(response, data) => {`);
				// code.push(`${tab(2)}let response = { headers: state.headers, body: data };`);
				// stage.stages.forEach(st => {
				// 	code.push(`${tab(2)}state = stateUtils.getState(response, '${st._id}');`);
				// 	code.push(`${tab(2)}response = await ${_.camelCase(st._id)}(req, state, stage);`);
				// 	code.push(`${tab(2)}if (response.statusCode >= 400) {`);
				// 	if (st.onError && st.onError.length > 0) {
				// 		code.push(`${tab(3)}state = stateUtils.getState(response, '${st.onError[0]._id}');`);
				// 		code.push(`${tab(3)}await ${_.camelCase(st.onError[0]._id)}(req, state, stage);`);
				// 	} else {
				// 		code.push(`${tab(3)}return { statusCode: response.statusCode, body: response.body, headers: response.headers };`);
				// 	}
				// 	code.push(`${tab(2)}}`);
				// });
				// code.push(`${tab(2)}});`);
				// code.push(`${tab(2)}return { statusCode: 200, body: promises.body, headers: state.headers };`);
			}
		} else {
			code.push(`${tab(2)}return { statusCode: 200, body: state.body, headers: state.headers };`);
		}
		code.push(`${tab(1)}} catch (err) {`);
		code.push(`${tab(2)}state.statusCode = 500;`);
		code.push(`${tab(2)}state.body = err;`);
		code.push(`${tab(2)}state.status = "ERROR";`);
		code.push(`${tab(2)}logger.error(err);`);
		code.push(`${tab(2)}return { statusCode: 500, body: err, headers: state.headers };`);
		code.push(`${tab(1)}} finally {`);
		code.push(`${tab(2)}stage['${stage._id}'] = state;`);
		code.push(`${tab(2)}stateUtils.upsertState(req, state);`);
		code.push(`${tab(1)}}`);
		code.push('}');
	});
	return _.concat(code, loopCode, exportsCode).join('\n');
}

function parseHeaders(headers) {
	let tempHeaders = {};
	if (headers) {
		if (typeof headers === 'string' && headers.indexOf('{{') > -1) {
			return headers.replaceAll('{{', '${').replaceAll('}}', '}');
		} else if (typeof headers === 'object') {
			Object.keys(headers).forEach(key => {
				tempHeaders[key] = parseHeaders(headers[key]);
			});
		}
	}
	return JSON.stringify(tempHeaders);
}

function parseBody(body) {
	let tempBody = {};
	if (body) {
		if (typeof body === 'string' && body.indexOf('{{') > -1) {
			return body.replaceAll('{{', '${').replaceAll('}}', '}');
		} else if (typeof body === 'object') {
			Object.keys(body).forEach(key => {
				tempBody[key] = parseBody(body[key]);
			});
		}
	}
	return JSON.stringify(tempBody);
}


module.exports.parseFlow = parseFlow;
module.exports.parseStages = parseStages;