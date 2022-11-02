const logger = global.logger;
const _ = require('lodash');
const envConfig = require('../config');


function constructFlowEvent(req, doc, flow, action) {
	try {
		logger.debug('Constructing event - ', doc.name, flow.name, action);

		const obj = {
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
		const inputObj = flow.inputNode;
		const outputObj = flow.nodes[0];
		const inputType = inputObj.type;
		const outputType = outputObj.type;
		let inputContentType = 'BINARY';
		let outputContentType = 'BINARY';

		if (inputObj.options.contentType === 'application/json') {
			inputContentType = 'JSON';
		}

		if (inputObj.dataStructure && inputObj.dataStructure.outgoing && inputObj.dataStructure.outgoing._id) {
			inputContentType = flow.dataStructures[inputObj.dataStructure.outgoing._id].formatType || 'JSON';
		}
		if (outputObj.dataStructure && outputObj.dataStructure.outgoing && outputObj.dataStructure.outgoing._id) {
			outputContentType = flow.dataStructures[outputObj.dataStructure.outgoing._id].formatType || 'JSON';
		}

		let agentList = [];
		if (inputType === 'FILE') {
			inputObj.options.agents.forEach(agent => {
				agentList.push({ agentID: agent.agentId, type: 'FILE', blockType: 'input' });
			});
		}
		if (outputType === 'FILE') {
			outputObj.options.agents.forEach(agent => {
				agentList.push({ agentID: agent.agentId, type: 'FILE', blockType: 'output' });
			});
		}
		logger.debug(`${JSON.stringify({ action, agentListLen: agentList.length })}`);
		let agentActionList = agentList.map((agent) => {
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
				metaData = {
					'fileSuffix': _.lowerCase(fileSuffix),
					'fileMaxSize': envConfig.maxFileSize
				};
				if (['BINARY', 'DELIMITER', 'FLATFILE'].indexOf(inputContentType) > -1) {
					metaData.fileSuffix = '.';
				}
			} else if (agentType === 'FILE' && agent.blockType === 'output') {
				let fileSuffix = outputContentType;
				metaData = {
					'fileSuffix': _.lowerCase(fileSuffix)
				};
				if (['BINARY', 'DELIMITER', 'FLATFILE'].indexOf(outputContentType) > -1) {
					metaData.fileSuffix = '.';
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
			agentActionObject['agentID'] = agent.agentID;
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