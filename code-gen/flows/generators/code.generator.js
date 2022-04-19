// const log4js = require('log4js');
const _ = require('lodash');
const { v4: uuid } = require('uuid');
const config = require('../config');

// const logger = log4js.getLogger(global.loggerName);

let visitedStages = [];
let visitedValidation = [];

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
	visitedStages = [];
	const inputStage = dataJson.inputStage;
	const stages = dataJson.stages;
	let api = '/' + dataJson.app + inputStage.options.path;
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
	code.push(`router.${(inputStage.options.method || 'POST').toLowerCase()}('${api}', async function (req, res) {`);
	code.push(`${tab(1)}let txnId = req.headers['data-stack-txn-id'];`);
	code.push(`${tab(1)}let remoteTxnId = req.headers['data-stack-remote-txn-id'];`);
	code.push(`${tab(1)}let response = req;`);
	code.push(`${tab(1)}let state = stateUtils.getState(response, '${inputStage._id}');`);
	code.push(`${tab(1)}let stage = {};`);
	code.push(`${tab(1)}stage['${inputStage._id}'] = state;`);
	code.push(`${tab(1)}let isResponseSent = false;`);
	let tempStages = (inputStage.onSuccess || []);
	for (let index = 0; index < tempStages.length; index++) {
		const ss = tempStages[index];
		const stage = stages.find(e => e._id === ss._id);
		if (ss.condition) {
			stage.condition = ss.condition.replaceAll('{{', '').replaceAll('}}', '');
		}
		if (visitedStages.indexOf(stage._id) > -1) {
			return;
		}
		visitedStages.push(stage._id);
		if (stage.condition) code.push(`${tab(1)}if (${stage.condition}) {`);
		code = code.concat(generateCode(stage, stages));
		if (stage.condition) code.push(`${tab(1)}}`);
	}
	// (inputStage.onSuccess || []).map(ss => {
	// 	const stageCondition = ss.condition;
	// 	const temp = stages.find(e => e._id === ss._id);
	// 	temp.condition = stageCondition;
	// 	return temp;
	// }).forEach((stage, i) => {
	// 	if (visitedStages.indexOf(stage._id) > -1) {
	// 		return;
	// 	}
	// 	visitedStages.push(stage._id);
	// 	if (stage.condition) code.push(`${tab(1)}if (${stage.condition}) {`);
	// 	code = code.concat(generateCode(stage, stages));
	// 	if (stage.condition) code.push(`${tab(1)}}`);
	// });
	code.push(`${tab(1)}return isResponseSent ? true : res.status((response.statusCode || 200)).json(response.body)`);
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
		code.push(`${tab(2)}let statusCode;`);
		code.push(`${tab(2)}let responseBody;`);
		if (stage.options && stage.options.statusCode) {
			code.push(`${tab(2)}statusCode = ${stage.options.statusCode};`);
		} else {
			code.push(`${tab(2)}statusCode = response.statusCode;`);
		}
		if (stage.options && stage.options.body) {
			code.push(`${tab(2)}responseBody = JSON.parse(\`${parseBody(stage.options.body)}\`);`);
		} else {
			code.push(`${tab(2)}responseBody = response.body;`);
		}
		code.push(`${tab(2)}res.status(statusCode).json(responseBody)`);
	} else {
		code.push(`${tab(2)}state = stateUtils.getState(response, '${stage._id}');`);
		code.push(`${tab(2)}response = await stageUtils.${_.camelCase(stage._id)}(req, state, stage);`);
		code.push(`${tab(2)}if (response.statusCode >= 400) {`);
		if (stage.onError && stage.onError.length > 0) {
			code.push(`${tab(3)}state = stateUtils.getState(response, '${stage.onError[0]._id}');`);
			code.push(`${tab(3)}await stageUtils.${_.camelCase(stage.onError[0]._id)}(req, state, stage);`);
		} else {
			code.push(`${tab(3)}return isResponseSent ? true : res.status((response.statusCode || 200)).json(response.body)`);
		}
		code.push(`${tab(2)}}`);
	}
	code.push(`${tab(1)}} catch (err) {`);
	code.push(`${tab(2)}logger.error(err);`);
	code.push(`${tab(2)}return isResponseSent ? true : res.status(500).json({ message: err.message });`);
	code.push(`${tab(1)}}`);
	let tempStages = (stage.onSuccess || []);
	for (let index = 0; index < tempStages.length; index++) {
		const ss = tempStages[index];
		const nextStage = stages.find(e => e._id === ss._id);
		if (ss.condition) {
			nextStage.condition = ss.condition.replaceAll('{{', '').replaceAll('}}', '');
		}
		if (visitedStages.indexOf(nextStage._id) > -1) {
			return;
		}
		visitedStages.push(nextStage._id);
		if (nextStage.condition) code.push(`${tab(1)}if (${nextStage.condition}) {`);
		code = code.concat(generateCode(nextStage, stages));
		if (nextStage.condition) code.push(`${tab(1)}}`);
	}
	// (stage.onSuccess || []).map(ss => {
	// 	const stageCondition = ss.condition;
	// 	const temp = stages.find(e => e._id === ss._id);
	// 	temp.condition = stageCondition;
	// 	return temp;
	// }).forEach((stage, i) => {
	// 	if (visitedStages.indexOf(stage._id) > -1) {
	// 		return;
	// 	}
	// 	visitedStages.push(stage._id);
	// 	if (stage.condition) code.push(`${tab(1)}if (${stage.condition}) {`);
	// 	code = code.concat(generateCode(stage, stages));
	// 	if (stage.condition) code.push(`${tab(1)}}`);
	// });
	return code;
}

function parseStages(dataJson) {
	visitedStages = [];
	const code = [];
	code.push('const log4js = require(\'log4js\');');
	code.push('const _ = require(\'lodash\');');
	code.push('const httpClient = require(\'./http-client\');');
	code.push('const commonUtils = require(\'./common.utils\');');
	code.push('const stateUtils = require(\'./state.utils\');');
	code.push('const validationUtils = require(\'./validation.utils\');');
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
		let functionName = 'validate_structure_' + _.camelCase(stage._id);
		if (stage.type === 'API' || stage.type === 'DATASERVICE' || stage.type === 'FAAS' || stage.type === 'FLOW' || stage.type === 'AUTH-DATASTACK') {
			code.push(`${tab(2)}const options = {};`);
			code.push(`${tab(2)}let customHeaders = {};`);
			code.push(`${tab(2)}let customBody = state.body;`);
			if (stage.type === 'API' && stage.options) {
				code.push(`${tab(2)}state.url = \`${parseDynamicVariable(stage.options.host)}${parseDynamicVariable(stage.options.path)}\`;`);
				code.push(`${tab(2)}state.method = '${stage.options.method}';`);
				code.push(`${tab(2)}options.url = state.url;`);
				code.push(`${tab(2)}options.method = state.method;`);
				if (stage.options.headers && !_.isEmpty(stage.options.headers)) {
					code.push(`${tab(2)}customHeaders = JSON.parse(\`${parseHeaders(stage.options.headers)}\`);`);
				}
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
				code.push(`${tab(2)}state.url = \`${config.baseUrlBM}/\${faas.app}/faas/\${faas.api}\`;`);
				code.push(`${tab(2)}state.method = '${stage.options.method}';`);
				code.push(`${tab(2)}options.url = state.url;`);
				code.push(`${tab(2)}options.method = state.method;`);
				code.push(`${tab(2)}customHeaders = JSON.parse(\`${parseHeaders(stage.options.headers)}\`);`);
				if (stage.options.body && !_.isEmpty(stage.options.body)) {
					code.push(`${tab(2)}customBody = JSON.parse(\`${parseBody(stage.options.body)}\`);`);
				}
			} else if (stage.type === 'FLOW') {
				code.push(`${tab(2)}const flow = await commonUtils.getFlow('${stage.options._id}');`);
				code.push(`${tab(2)}state.url = \`${config.baseUrlBM}/\${flow.app}/flow/\${flow.inputStage.options.path}\`;`);
				code.push(`${tab(2)}state.method = '${stage.options.method}';`);
				code.push(`${tab(2)}options.url = state.url;`);
				code.push(`${tab(2)}options.method = state.method;`);
				code.push(`${tab(2)}customHeaders = JSON.parse(\`${parseHeaders(stage.options.headers)}\`);`);
				if (stage.options.body && !_.isEmpty(stage.options.body)) {
					code.push(`${tab(2)}customBody = JSON.parse(\`${parseBody(stage.options.body)}\`);`);
				}
			} else if (stage.type === 'AUTH-DATASTACK') {
				code.push(`${tab(2)}const password = '${stage.options.password}'`);
				code.push(`${tab(2)}state.url = '${config.baseUrlUSR}/auth/login'`);
				code.push(`${tab(2)}state.method = 'POST';`);
				code.push(`${tab(2)}options.url = state.url;`);
				code.push(`${tab(2)}options.method = state.method;`);
				code.push(`${tab(2)}customHeaders = state.headers;`);
				code.push(`${tab(2)}customBody = { username: '${stage.options.username}', password: '${stage.options.password}' };`);
			}
			code.push(`${tab(2)}options.headers = _.merge(state.headers, customHeaders);`);
			code.push(`${tab(2)}if (options.method == 'POST' || options.method == 'PUT') {`);
			code.push(`${tab(3)}options.json = customBody;`);
			code.push(`${tab(2)}}`);
			code.push(`${tab(2)}delete options.headers['cookie'];`);
			code.push(`${tab(2)}delete options.headers['host'];`);
			code.push(`${tab(2)}delete options.headers['connection'];`);
			code.push(`${tab(2)}delete options.headers['user-agent'];`);
			code.push(`${tab(2)}delete options.headers['content-length'];`);
			code.push(`${tab(2)}const response = await httpClient.request(options);`);
			code.push(`${tab(3)}logger.trace(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Reponse Data of ${_.camelCase(stage._id)} \`, response.statusCode, response.headers, response.body);`);
			code.push(`${tab(2)}state.statusCode = response.statusCode;`);
			code.push(`${tab(2)}state.body = response.body;`);
			code.push(`${tab(2)}state.headers = response.headers;`);
			code.push(`${tab(2)}if (response && response.statusCode != 200) {`);
			code.push(`${tab(3)}state.status = "ERROR";`);
			code.push(`${tab(3)}state.statusCode = response && response.statusCode ? response.statusCode : 400;`);
			code.push(`${tab(3)}state.body = response && response.body ? response.body : { message: 'Unable to reach the URL' };`);
			code.push(`${tab(3)}logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Ending ${_.camelCase(stage._id)} Stage with not 200\`, response.statusCode);`);
			code.push(`${tab(3)}return { statusCode: response.statusCode, body: response.body, headers: response.headers };`);
			code.push(`${tab(2)}}`);

			code.push(`${tab(2)}const errors = validationUtils.${functionName}(req, response.body);`);
			code.push(`${tab(2)}if (errors) {`);
			code.push(`${tab(3)}state.status = "ERROR";`);
			code.push(`${tab(3)}state.statusCode = 400;`);
			code.push(`${tab(3)}state.body = { message: errors };`);
			code.push(`${tab(3)}logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Ending ${_.camelCase(stage._id)} Stage with not 200\`);`);
			code.push(`${tab(3)}return { statusCode: 400, body: { message: errors }, headers: response.headers };`);
			code.push(`${tab(2)}}`);

			code.push(`${tab(2)}state.status = "SUCCESS";`);
			code.push(`${tab(3)}state.statusCode = 200;`);
			code.push(`${tab(2)}logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Ending ${_.camelCase(stage._id)} Stage with 200\`);`);
			code.push(`${tab(2)}return { statusCode: response.statusCode, body: response.body, headers: response.headers };`);
		} else if ((stage.type === 'TRANSFORM' || stage.type === 'MAPPING') && stage.mapping) {
			code.push(`${tab(2)}let newBody = {};`);
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
			code.push(`${tab(2)}newBody = [];`);
			code.push(`${tab(3)}state.body.forEach(item => {`);
			code.push(`${tab(2)}let tempBody = {};`);
			stage.mapping.forEach(mappingData => {
				code.push(`${tab(4)}_.set(tempBody, '${mappingData.target.dataPath}', ${mappingData.formulaID}(item));`);
			});
			code.push(`${tab(2)}newBody.push(tempBody);`);
			code.push(`${tab(3)}});`);
			code.push(`${tab(2)}} else {`);
			stage.mapping.forEach(mappingData => {
				code.push(`${tab(3)}_.set(newBody, '${mappingData.target.dataPath}', ${mappingData.formulaID}(state.body));`);
			});
			code.push(`${tab(2)}}`);

			code.push(`${tab(2)}const errors = validationUtils.${functionName}(req, newBody);`);
			code.push(`${tab(2)}if (errors) {`);
			code.push(`${tab(3)}state.status = "ERROR";`);
			code.push(`${tab(3)}state.statusCode = 400;`);
			code.push(`${tab(3)}state.body = { message: errors };`);
			code.push(`${tab(3)}logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Validation Error ${_.camelCase(stage._id)} \`, errors);`);
			code.push(`${tab(3)}logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Ending ${_.camelCase(stage._id)} Stage with not 200\`);`);
			code.push(`${tab(3)}return { statusCode: 400, body: { message: errors }, headers: response.headers };`);
			code.push(`${tab(2)}}`);

			code.push(`${tab(2)}return { statusCode: 200, body: newBody, headers: state.headers };`);
		} else if (stage.type === 'VALIDATION' && stage.validation) {
			code.push(`${tab(2)}let errors = {};`);
			Object.keys(stage.validation).forEach(field => {
				const formulaID = 'formula_' + _.camelCase(uuid());
				stage.validation[field] = {
					code: stage.validation[field],
					formulaID
				};
				const formulaCode = [];
				formulaCode.push(`function ${formulaID}(data) {`);
				formulaCode.push(`${tab(1)}try {`);
				formulaCode.push(`${tab(2)}${stage.validation[field].code}`);
				formulaCode.push(`${tab(1)}} catch(err) {`);
				formulaCode.push(`${tab(2)}logger.error(err);`);
				formulaCode.push(`${tab(2)}throw err;`);
				formulaCode.push(`${tab(1)}}`);
				formulaCode.push('}');
				code.push(formulaCode.join('\n'));
			});
			code.push(`${tab(2)}if (Array.isArray(state.body)) {`);
			code.push(`${tab(3)}errors = [];`);
			code.push(`${tab(3)}state.body.forEach(item => {`);
			code.push(`${tab(4)}let error;`);
			code.push(`${tab(4)}let errorObj;`);
			Object.keys(stage.validation).forEach(field => {
				code.push(`${tab(4)}error = ${stage.validation[field].formulaID}(item);`);
				code.push(`${tab(4)}if (error) {`);
				code.push(`${tab(5)}errorObj['${field}'] = error;`);
				code.push(`${tab(4)}}`);
			});
			code.push(`${tab(3)}if (Object.keys(errorObj).length > 0) {`);
			code.push(`${tab(4)}errors.push(errorObj);`);
			code.push(`${tab(3)}}`);
			code.push(`${tab(3)}});`);
			code.push(`${tab(3)}if (errors && errors.length > 0) {`);
			code.push(`${tab(4)}state.status = 'ERROR'`);
			code.push(`${tab(4)}state.statusCode = 400;`);
			code.push(`${tab(4)}state.body = errors;`);
			code.push(`${tab(4)}logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Validation Error ${_.camelCase(stage._id)} \`, errors);`);
			code.push(`${tab(4)}return { statusCode: 400, body: errors, headers: state.headers };`);
			code.push(`${tab(3)}}`);
			code.push(`${tab(2)}} else {`);
			code.push(`${tab(3)}let error;`);
			Object.keys(stage.validation).forEach(field => {
				code.push(`${tab(3)}error = ${stage.validation[field].formulaID}(state.body);`);
				code.push(`${tab(3)}if (error) {`);
				code.push(`${tab(4)}errors['${field}'] = error;`);
				code.push(`${tab(3)}}`);
			});
			code.push(`${tab(3)}if (Object.keys(errors).length > 0) {`);
			code.push(`${tab(4)}state.status = 'ERROR'`);
			code.push(`${tab(4)}state.statusCode = 400;`);
			code.push(`${tab(4)}state.body = errors;`);
			code.push(`${tab(4)}logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Validation Error ${_.camelCase(stage._id)} \`, errors);`);
			code.push(`${tab(4)}return { statusCode: 400, body: errors, headers: state.headers };`);
			code.push(`${tab(3)}}`);
			code.push(`${tab(2)}}`);
			code.push(`${tab(2)}return { statusCode: 200, body: state.body, headers: state.headers };`);
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
					code.push(`${tab(3)}state.status = 'ERROR'`);
					code.push(`${tab(3)}state.statusCode = response.statusCode;`);
					code.push(`${tab(3)}state.body = response.body;`);
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
		code.push(`${tab(2)}if (err.body) {`);
		code.push(`${tab(3)}state.body = err.body;`);
		code.push(`${tab(3)}logger.error(err.body);`);
		code.push(`${tab(2)}} else if (err.message) {`);
		code.push(`${tab(3)}state.body = { message: err.message };`);
		code.push(`${tab(3)}logger.error(err.message);`);
		code.push(`${tab(2)}} else {`);
		code.push(`${tab(3)}state.body = err;`);
		code.push(`${tab(3)}logger.error(err);`);
		code.push(`${tab(2)}}`);
		code.push(`${tab(2)}state.status = "ERROR";`);
		code.push(`${tab(2)}return { statusCode: 500, body: err, headers: state.headers };`);
		code.push(`${tab(1)}} finally {`);
		code.push(`${tab(2)}stage['${stage._id}'] = state;`);
		code.push(`${tab(2)}stateUtils.upsertState(req, state);`);
		code.push(`${tab(1)}}`);
		code.push('}');
	});
	return _.concat(code, loopCode, exportsCode).join('\n');
}

function parseDynamicVariable(value) {
	if (value) {
		return value.replaceAll('{{', '${').replaceAll('}}', '}');
	}
}

function parseHeaders(headers) {
	let tempHeaders = {};
	if (headers) {
		if (typeof headers === 'object') {
			Object.keys(headers).forEach(key => {
				tempHeaders[key] = parseHeaders(headers[key]);
			});
		} else if (typeof headers === 'string' && headers.indexOf('{{') > -1) {
			return parseDynamicVariable(headers);
		} else {
			return headers;
		}
	}
	return JSON.stringify(tempHeaders);
}

function parseBody(body) {
	let tempBody = {};
	if (body) {
		if (typeof body === 'object') {
			Object.keys(body).forEach(key => {
				tempBody[key] = parseBody(body[key]);
			});
		} else if (typeof body === 'string' && body.indexOf('{{') > -1) {
			return parseDynamicVariable(body);
		} else {
			return body;
		}
	}
	return JSON.stringify(tempBody);
}


function parseDataStructures(dataJson) {
	visitedValidation = [];
	const code = [];
	code.push('const fs = require(\'fs\');');
	code.push('const path = require(\'path\');');
	code.push('const log4js = require(\'log4js\');');
	code.push('const Ajv = require(\'ajv\');');
	code.push('const _ = require(\'lodash\');');
	code.push('const ajv = new Ajv();');
	code.push('');
	code.push('const logger = log4js.getLogger(global.loggerName);');
	code.push('');
	if (dataJson.dataStructures && Object.keys(dataJson.dataStructures).length > 0) {
		Object.keys(dataJson.dataStructures).forEach(schemaID => {
			code.push(`let schema_${schemaID} = fs.readFileSync(\`./schemas/${schemaID}.schema.json\`).toString();`);
			code.push(`schema_${schemaID} = JSON.parse(schema_${schemaID});`);
			code.push(`const validate_${schemaID} = ajv.compile(schema_${schemaID});`);
		});
	}
	return _.concat(code, generateDataStructures(dataJson.inputStage, dataJson.stages)).join('\n');
}

function generateDataStructures(stage, stages) {
	let code = [];
	const exportsCode = [];
	let schemaID;
	if (stage.dataStructure && stage.dataStructure.outgoing && stage.dataStructure.outgoing._id) {
		schemaID = (stage.dataStructure.outgoing._id);
	}
	const functionName = 'validate_structure_' + _.camelCase(stage._id);
	exportsCode.push(`module.exports.${functionName} = ${functionName};`);
	code.push(`function ${functionName}(req, data) {`);
	if (schemaID) {
		code.push(`${tab(1)}logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] Validation Data Structure ${_.camelCase(stage._id)} Stage\`);`);
		code.push(`${tab(1)}const valid = validate_${schemaID}(data);`);
		code.push(`${tab(1)}if (!valid) throw Error(ajv.errorsText(validate_${schemaID}.errors));`);
	} else {
		code.push(`${tab(1)}logger.info(\`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}] No Data Structure found for ${_.camelCase(stage._id)} Stage\`);`);
	}
	code.push(`${tab(1)}return null;`);
	code.push('}');
	let tempStages = (stage.onSuccess || []);
	for (let index = 0; index < tempStages.length; index++) {
		const ss = tempStages[index];
		const nextStage = stages.find(e => e._id === ss._id);
		if (visitedValidation.indexOf(nextStage._id) > -1) {
			return;
		}
		visitedValidation.push(nextStage._id);
		code = code.concat(generateDataStructures(nextStage, stages));
	}
	return _.concat(code, exportsCode).join('\n');
}


module.exports.parseFlow = parseFlow;
module.exports.parseStages = parseStages;
module.exports.parseDataStructures = parseDataStructures;