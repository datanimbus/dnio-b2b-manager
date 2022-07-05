const logger = global.logger;
const _ = require('lodash');
const envConfig = require('../config');

let e = {};

e.constructEvent = function (doc, flow, action, req) {
	logger.debug('Constructing event - ', doc.name, flow.name, action);
	let obj = null;
	let inputObj = null;
	let outputObj = null;
	let inputType = null;
	let outputType = null;
	let promise = Promise.resolve();

	obj = {
		'appName': flow.app,
		'agentName': doc.name,
		'flowName': flow.name,
		'agentID': doc.agentId,
		'flowID': flow._id,
		'deploymentName': flow.deploymentName,
		'timestamp': new Date(),
		'entryType': 'IN',
		'sentOrRead': false
	};
	inputObj = flow.inputStage;
	outputObj = flow.stages[0];
	inputType = inputObj.type;
	outputType = outputObj.type;

	let agentList = [];
	if (inputType === 'FILE') {
		agentList.push({ agentID: inputObj.options.agentId, type: 'FILE', blockType: 'input' });
	}
	if (outputType === 'FILE') {
		agentList.push({ agentID: outputObj.options.agentId, type: 'FILE', blockType: 'output' });
	}
	promise = Promise.resolve(agentList);

	return promise.then(agentObjs => {
		logger.debug(`${JSON.stringify({ action, agentObjsLen: agentObjs.length })}`);
		let eventPromise = agentObjs.map(_agentObj => {
			let agentType = _agentObj.type;
			let newObj = JSON.parse(JSON.stringify(obj));
			if (action === 'create') {
				newObj['action'] = agentType === 'FILE' ? 'FLOW_CREATE_REQUEST' : 'CREATE_API_FLOW_REQUEST';
			}
			else if (action === 'deploy') {
				newObj['action'] = agentType === 'FILE' ? 'FLOW_CREATE_REQUEST' : 'CREATE_API_FLOW_REQUEST';
			}
			else if (action === 'start') {
				newObj['action'] = agentType === 'FILE' ? 'FLOW_START_REQUEST' : 'START_API_FLOW_REQUEST';
			}
			else if (action === 'stop') {
				newObj['action'] = agentType === 'FILE' ? 'FLOW_STOP_REQUEST' : 'STOP_API_FLOW_REQUEST';
			}
			else if (action === 'update') {
				newObj['action'] = agentType === 'FILE' ? 'FLOW_UPDATE_REQUEST' : 'UPDATE_API_FLOW_REQUEST';
			}
			else if (action === 'delete') {
				newObj['action'] = agentType === 'FILE' ? 'DELETE_FLOW_REQUEST' : 'DELETE_API_FLOW_REQUEST';
			}
			else if (action === 'kill') {
				newObj['action'] = 'STOP_AGENT';
			}

			let metaData = {};

			if (action === 'kill') {
				//do nothing
			}
			else if (agentType === 'FILE' && _agentObj.blockType === 'input') {
				let fileSuffix = inputObj.options.contentType;
				metaData = {
					'fileSuffix': String(fileSuffix).toLowerCase(),
					'fileMaxSize': envConfig.B2B_AGENT_MAX_FILE_SIZE
				};
				if (['BINARY', 'DELIMITER', 'FLATFILE'].indexOf(inputObj.options.contentType) > -1) {
					metaData.fileSuffix = '.';
				}
			}
			else if (agentType === 'FILE' && _agentObj.blockType === 'output') {
				let fileSuffix = outputObj.options.contentType;
				metaData = {
					'fileSuffix': String(fileSuffix).toLowerCase()
				};
				if (['BINARY', 'DELIMITER', 'FLATFILE'].indexOf(outputObj.options.contentType) > -1) {
					metaData.fileSuffix = '.';
				}
			}
            
			if (inputObj && inputType === 'FILE' && agentType === 'FILE' && _agentObj.blockType === 'input') {
				if (outputObj && outputType === 'FILE') {
					metaData.targetAgentID = outputObj.options.agentId;
				}
			}
			if (outputObj && outputType === 'FILE' && agentType === 'FILE' && _agentObj.blockType === 'output') {
				if (inputObj && inputType === 'FILE') {
					metaData.targetAgentID = inputObj.options.agentId;
				}
			}
            
			let metaDataPromise = Promise.resolve(metaData);
			return metaDataPromise
				.then(_md => {
					newObj['metaData'] = JSON.stringify(_md);
					newObj['agentID'] = _agentObj.agentID;
					return newObj;
				});
		});
		return Promise.all(eventPromise);
	});
};

module.exports = e;