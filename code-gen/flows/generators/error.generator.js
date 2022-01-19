const log4js = require('log4js');
const logger = log4js.getLogger('error.generator');
const { getSchemaValidationMiddleware, getTransformMiddleware, getProcessRequestMiddleware, getAuthMiddleware, getErrorBlock } = require('./request.generator');


function parseFlowJSON(requestPhases) {

	logger.debug('Parsing Flow Error Blocks');

	const middlewares = [];

	requestPhases.forEach((node, i) => {

		if (i === 0 && node.meta.sourceFormat.strictValidation) {
			middlewares.push(getSchemaValidationMiddleware(node, 'ERROR'));
		}

		if (node.meta.blockType === 'PROCESS' && node.meta.processType === 'REQUEST') {

			if (node.meta.sourceFormat.strictValidation) {
				middlewares.push(getSchemaValidationMiddleware(node, node.source));
			}

			middlewares.push(getProcessRequestMiddleware(node));

			if (node.meta.targetFormat.strictValidation) {
				middlewares.push(getSchemaValidationMiddleware(node, node.target));
			}

		} else if (node.meta.blockType === 'PROCESS' && node.meta.processType === 'TRANSFORM') {

			middlewares.push(getTransformMiddleware(node));

		} else if (node.meta.blockType === 'OUTPUT') {

			if (node.meta.sourceFormat.strictValidation) {
				middlewares.push(getSchemaValidationMiddleware(node, node.source));
			}

			middlewares.push(errorOutputMiddleware(node));
		}
	});

	middlewares.push(sendResponse(requestPhases.pop()));

	return {
		middlewares
	};
}


function errorOutputMiddleware(node) {

	let nodeType = (node.meta.blockType === 'PROCESS') ? node.meta.processType : node.meta.blockType;
	let nodeName = node.meta.name || `Node ${node.meta.sequenceNo}`;

	let customHeaders = node.meta.customHeaders;

	for (h in customHeaders) {
		customHeaders[h.toLowerCase()] = customHeaders[h]
		delete (customHeaders[h]);
	}

	return `
		logger.info('Starting Processing Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType}');

		logger.trace('Output Data - ', JSON.stringify(req.body));
		logger.trace('Output Headers - ', JSON.stringify(req.headers));

		let timestamp = new Date();

		try {
			req['local']['nodeName'] = '${nodeName}';
			req['local']['flowType'] = '${node.meta.flowType}';
			req['local']['nodeType'] = '${nodeType}';
			req['local']['nodeId'] = '${node.meta.sequenceNo}';

			let headers = { ...${JSON.stringify(customHeaders)}, ...req.headers };

			${ node.meta.contentType === 'XML' ?
				`	logger.debug('Parsing Output data from JSON to XML');

					req.body = new J2XParser().parse(req.body);

					headers['content-type'] = 'application/xml';

					logger.debug('Connection type - ${node.meta.connectionDetails['connectionType']}');

					${getAuthMiddleware(node, node.meta.connectionDetails)}

					let response = await postRequest(options, false);
				`
				:
				`	logger.debug('Connection type - ${node.meta.connectionDetails['connectionType']}');

					${getAuthMiddleware(node, node.meta.connectionDetails)}

					let response = await postRequest(options);
				`
			}

			logger.debug('Response received from url - ', options.url);
			logger.trace('Response Body - ', JSON.stringify(response.body));
			logger.trace('Response Headers - ', JSON.stringify(response.headers));

			if (response.statusCode > 199 && response.statusCode < 300) {

				let interactionBlock = {
					timestamp: timestamp,
					createTimestamp: timestamp,
					completedTimestamp: new Date(),
					inputStructureID: '${node.meta.sourceFormat.id || ''}',
					outputStructureID: '${node.meta.targetFormat.id || ''}',
					type: 'API',
					serviceID: '${node.meta.formatId}',
					serviceName: '${node.meta.formatName}',
					url: '${node.meta.connectionDetails.url}',
					connectionType: '${node.meta.connectionDetails.connectionType}',
					statusCode: response.statusCode
				}

				logger.trace('Interaction Block Data -> NodeName - ${nodeName} | NodeType - ${nodeType} - ', interactionBlock);

				global.dbPromises.push(upsertInteractionBlock(req, interactionBlock));

				req['local']['statusCode'] = response.statusCode;
				req['local']['body'] = response.body;

				next();

			} else {
				logger.info('Response with non 200 status code received, throwing error');
				let err = {
					statusCode: response.statusCode,
					message: response.body
				}
				${getErrorBlock(node, 'API', 400)}
			}
		} catch (err) {
			${getErrorBlock(node, 'API', 500)}
		}
	`;
}


function sendResponse(node) {
	return `
		let statusCode = req['local']['statusCode'];
		let body = req['local']['body'];

		logger.debug('Returned Response Code from Error Flow - ', statusCode)
		logger.trace('Returned Response Body from Error flow - ', body)
		${ node.meta.contentType === 'XML' ?
			`
				res.set('content-type', 'application/xml');
				res.status(statusCode).send(body);
			`
	  		:
			`	res.status(statusCode).json(body);
			`
		}
  	`;
}


async function getErrorContent(flowData) {

	const errorPhases = flowData.errorBlocks;

	if (errorPhases && errorPhases.length > 0) {

		const { middlewares } = parseFlowJSON(errorPhases);

		return {
			content:
				`	const errorRouter = require('express').Router();
					const { getErrorResponse, getSchemaErrors, postRequest } = require('../utils/flow.utils.js');
					const { upsertInteraction, upsertInteractionBlock } = require('../utils/db.utils.js');
					const _ = require('lodash');
					const request = require('request');
					const log4js = require('log4js');
					const fs = require('fs');
					const path = require('path');

					if (process.env.NODE_ENV != 'production') {
						require('dotenv').config();
					}

					const config = require('../config');
					const flowData = require('../flow.json');

					let logger = global.logger;

					errorRouter.use((req, res, next) => {
						if (req.header('data-stack-txn-id')) {
							logger = log4js.getLogger(\`\${global.loggerName} [\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}]\`);
						}
						req['local'] = {};
						req['local']['data-stack-txn-id'] = req.header('data-stack-txn-id');
						req['local']['data-stack-remote-txn-id'] = req.header('data-stack-remote-txn-id');
						req['local']['data-stack-mirror-directory'] = req.header('data-stack-mirror-directory');
						req['local']['data-stack-operating-system'] = req.header('data-stack-operating-system');
						req['local']['data-stack-deployment-name'] = req.header('data-stack-deployment-name');
						req['local']['data-stack-file-md5'] = req.header('data-stack-file-md5');
						req['local']['data-stack-file-name'] = req.header('data-stack-file-name');
						req['local']['data-stack-file-size'] = req.header('data-stack-file-size');
						req['local']['data-stack-file-ext'] = req.header('data-stack-file-ext');
						req['local']['data-stack-nano-service'] = req.header('data-stack-nano-service');
						req['local']['data-stack-flow'] = req.header('data-stack-flow');
						next();
					});

					/**
					 * @description Input
					 */
					errorRouter.use(async (req, res, next) => {
						logger.info('Starting Processing Node -> NodeName - ${errorPhases[0].meta.name || `Node ${errorPhases[0].meta.sequenceNo}`} | NodeType - INPUT | FlowType - ERROR');

						let timestamp = new Date();

						logger.debug('Error Flow Request Received');
						logger.trace('Error Flow Request Body - ', JSON.stringify(req.body));
						logger.trace('Error Flow Header Data - ', JSON.stringify(req.headers));

						req['local']['data-stack-txn-id'] = req.header('data-stack-txn-id');
						req['local']['data-stack-remote-txn-id'] = req.header('data-stack-remote-txn-id');
						req['local']['flowType'] = 'error';
      					req['local']['nodeId'] = '1';
    					req['local']['nodeName'] = '${errorPhases[0].meta.name || `Node ${errorPhases[0].meta.sequenceNo}`}';

						let interactionBlock = {
							timestamp: timestamp,
							createTimestamp: timestamp,
							completedTimestamp: new Date(),
							inputStructureID: '${errorPhases[0].meta.sourceFormat.id}',
							type: 'API',
							endpoint: '/api/error'
						};

						logger.trace('Interaction Block Data -> NodeName - ${errorPhases[0].meta.name || `Node ${errorPhases[0].meta.sequenceNo}`} | NodeType - INPUT - ', interactionBlock);

						global.dbPromises.push(upsertInteractionBlock(req, interactionBlock));

						logger.info('Successfully Processed Node -> NodeName - ${errorPhases[0].meta.name || `Node ${errorPhases[0].meta.sequenceNo}`} | NodeType - INPUT | FlowType - ERROR');

						next();
					});

					${middlewares.map(e => `errorRouter.use(async (req, res, next) => {${e}});`).join('\n\n')}

					module.exports = errorRouter;
				`
		};
	} else {
		return {
			content:
				`	const errorRouter = require('express').Router();

					const logger = global.logger;

					// Echo Server
					errorRouter.use((req, res) => {
						logger.info('Processing Error Flow');

						logger.trace('Error Flow Request Body - ', JSON.stringify(req.body));
						logger.trace('Error Flow Request Header - ', JSON.stringify(req.headers));

						if (req.header('content-type') === 'application/json') {
							res.status(req.body.statusCode).json(req.body);
						} else {
							res.status(req.body.statusCode).send(req.body);
						}

						logger.info('Processed Error Flow');
					});

					module.exports = errorRouter;
				`
		};
	}
}


module.exports = { getErrorContent };
