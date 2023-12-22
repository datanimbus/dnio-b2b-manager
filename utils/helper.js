const logger = global.logger;
const _ = require('lodash');
const envConfig = require('../config');


function constructFlowEvent(req, doc, flow, action) {
	try {
		if (doc != '') {
			logger.debug('Constructing Flow Events for - ', doc.name, flow.name, action);
		} else {
			logger.debug('Constructing Flow Events for - ', flow.name, action);
		}

		const inputObj = flow.inputNode;
		const index = flow.nodes.findIndex(node => node.type === 'FILE');
		let outputObj = flow.nodes[index];
		const inputType = inputObj.type;
		const outputType = outputObj != null ? outputObj.type : null;
		let inputContentType = 'BINARY';
		let outputContentType = 'BINARY';

		if (inputObj.options.contentType === 'application/json') {
			inputContentType = 'JSON';
		}

		if (inputObj.dataStructure && inputObj.dataStructure.outgoing && inputObj.dataStructure.outgoing._id) {
			inputContentType = flow.dataStructures[inputObj.dataStructure.outgoing._id].formatType || 'JSON';
		}
		if (outputObj && outputObj.dataStructure && outputObj.dataStructure.outgoing && outputObj.dataStructure.outgoing._id) {
			outputContentType = flow.dataStructures[outputObj.dataStructure.outgoing._id].formatType || 'JSON';
		}

		let agentList = [];
		if (inputType === 'FILE') {
			inputObj.options.agents.forEach(agent => {
				agentList.push({ agentName: agent.name, agentId: agent.agentId, type: 'FILE', blockType: 'input' });
			});
		}
		if (outputType && outputType === 'FILE') {
			outputObj.options.agents.forEach(agent => {
				agentList.push({ agentName: agent.name, agentId: agent.agentId, type: 'FILE', blockType: 'output' });
			});
		}
		logger.debug(`${JSON.stringify({ action, agentListLen: agentList.length })}`);
		let agentActionList = agentList.map((agent) => {
			const obj = {
				'appName': flow.app,
				'agentName': agent.agentName,
				'flowName': flow.name,
				'agentId': agent.agentId,
				'flowId': flow._id,
				'deploymentName': flow.deploymentName,
				'timestamp': new Date(),
				'sentOrRead': false
			};
			let agentType = agent.type;
			let agentActionObject = JSON.parse(JSON.stringify(obj));
			if (action === 'create') {
				agentActionObject['action'] = agentType === 'FILE' ? 'FLOW_CREATE_REQUEST' : 'CREATE_API_FLOW_REQUEST';
			}
			else if (action === 'deploy') {
				agentActionObject['action'] = agentType === 'FILE' ? 'FLOW_CREATE_REQUEST' : 'CREATE_API_FLOW_REQUEST';
			}
			else if (action === 'start') {
				agentActionObject['action'] = agentType === 'FILE' ? 'FLOW_START_REQUEST' : 'START_API_FLOW_REQUEST';
			}
			else if (action === 'stop') {
				agentActionObject['action'] = agentType === 'FILE' ? 'FLOW_STOP_REQUEST' : 'STOP_API_FLOW_REQUEST';
			}
			else if (action === 'update') {
				agentActionObject['action'] = agentType === 'FILE' ? 'FLOW_UPDATE_REQUEST' : 'UPDATE_API_FLOW_REQUEST';
			}
			else if (action === 'delete') {
				agentActionObject['action'] = agentType === 'FILE' ? 'DELETE_FLOW_REQUEST' : 'DELETE_API_FLOW_REQUEST';
			}
			else if (action === 'kill') {
				agentActionObject['action'] = 'STOP_AGENT';
			}

			let metaData = {};

			if (action === 'kill') {
				//do nothing
			} else if (agentType === 'FILE' && agent.blockType === 'input') {
				let fileSuffix = inputContentType;
				if (inputContentType === 'EXCEL') {
					fileSuffix = flow.dataStructures[inputObj.dataStructure.outgoing._id].excelType;
				}
				metaData = {
					'fileSuffix': _.lowerCase(fileSuffix),
					'fileMaxSize': envConfig.maxFileSize,
					'direction': agent.blockType
				};
				if (['BINARY', 'DELIMITER', 'FLATFILE'].indexOf(inputContentType) > -1) {
					metaData.fileSuffix = '.';
				}
				if (inputObj.options.inputDirectories) {
					metaData.inputDirectories = inputObj.options.inputDirectories;
				}
				if (inputObj.options.uniqueTxnId) {
					metaData.uniqueRemoteTransaction = inputObj.options.uniqueTxnId;
				}
			} else if (agentType === 'FILE' && agent.blockType === 'output') {
				let fileSuffix = outputContentType;
				if (outputContentType === 'EXCEL') {
					fileSuffix = flow.dataStructures[outputObj.dataStructure.outgoing._id].excelType;
				}
				metaData = {
					'fileSuffix': _.lowerCase(fileSuffix),
					'direction': agent.blockType
				};
				if (['BINARY', 'DELIMITER', 'FLATFILE'].indexOf(outputContentType) > -1) {
					metaData.fileSuffix = '.';
				}
				if (outputObj.options.outputDirectories) {
					metaData.outputDirectories = outputObj.options.outputDirectories;
				}
				if (outputObj.options.mirrorInputDirectories) {
					metaData.mirrorInputDirectories = outputObj.options.mirrorInputDirectories;
				}
			}

			/*if (inputObj && inputType === 'FILE' && agentType === 'FILE' && agent.blockType === 'input') {
				if (outputObj && outputType === 'FILE') {
					metaData.targetAgentID = outputObj.options.agentId;
				}
			}
			if (outputObj && outputType === 'FILE' && agentType === 'FILE' && agent.blockType === 'output') {
				if (inputObj && inputType === 'FILE') {
					metaData.targetAgentID = inputObj.options.agentId;
				}
			}*/

			agentActionObject['metaData'] = JSON.stringify(metaData);
			return agentActionObject;
		});
		logger.trace({ agentActionList });
		return agentActionList;
	} catch (err) {
		logger.error(err);
	}
}

function constructAgentEvent(req, agentId, eventDetails, agentAction, metaData) {
	try {
		const obj = {
			'agentId': agentId,
			'appName': eventDetails.app,
			'agentName': eventDetails.agentName,
			'flowName': eventDetails.flowName,
			'flowId': eventDetails.flowId,
			'deploymentName': eventDetails.deploymentName,
			'timestamp': new Date(),
			'sentOrRead': false
		};

		let agentActionObject = JSON.parse(JSON.stringify(obj));
		agentActionObject['action'] = agentAction;
		agentActionObject['metaData'] = JSON.stringify(metaData);
		return agentActionObject;
	} catch (err) {
		logger.error(err);
	}
}

module.exports.constructFlowEvent = constructFlowEvent;
module.exports.constructAgentEvent = constructAgentEvent;