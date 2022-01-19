const log4js = require('log4js');
const logger = log4js.getLogger('success.generator');
const { getSchemaValidationMiddleware, getTransformMiddleware, getProcessRequestMiddleware, getAuthMiddleware, getErrorBlock } = require('./request.generator');


function parseFlowJSON(responsePhases, lastNode) {

  logger.debug('Parsing Flow Success Blocks');

  const middlewares = [];

  responsePhases.forEach((node, i) => {

    if (i === 0) {
      if (lastNode.meta.targetType === 'FILE') {
        middlewares.push(successFileInputMiddleware(node, lastNode));
      } else {
        middlewares.push(successAPIInputMiddleware(node));
      }

      if (node.meta.contentType !== 'BINARY' && node.meta.sourceFormat.strictValidation) {
        middlewares.push(getSchemaValidationMiddleware(node, node.source));
      }
    }

    if (node.meta.blockType === 'PROCESS' && node.meta.processType === 'REQUEST') {

      if (node.meta.sourceFormat.formatType !== 'BINARY' && node.meta.sourceFormat.strictValidation) {
        middlewares.push(getSchemaValidationMiddleware(node, node.source));
      }

      middlewares.push(getProcessRequestMiddleware(node));

      if (node.meta.targetFormat.formatType !== 'BINARY' && node.meta.targetFormat.strictValidation) {
        middlewares.push(getSchemaValidationMiddleware(node, node.target));
      }

    } else if (node.meta.blockType === 'PROCESS' && node.meta.processType === 'TRANSFORM') {

      middlewares.push(getTransformMiddleware(node));

    } else if (node.meta.blockType === 'OUTPUT') {

      if (node.meta.targetFormat.formatType !== 'BINARY' && node.meta.sourceFormat.strictValidation) {
        middlewares.push(getSchemaValidationMiddleware(node, node.source));
      }

      middlewares.push(successOutputMiddleware(node));
    }
  });

  middlewares.push(sendResponse(responsePhases.pop()));

  return {
    middlewares
  };
}


function successAPIInputMiddleware(node) {

  let nodeType = 'INPUT';
  let nodeName = node.meta.name || `Node ${node.meta.sequenceNo}`;
  let flowType = node.meta.flowType;

  return `
		logger.info('Starting Processing Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${flowType}');

		logger.debug('Success Flow Request Received');
		logger.trace('Success Flow Request Body - ', JSON.stringify(req.body));
		logger.trace('Success Flow Request Header - ', JSON.stringify(req.headers));

		let timestamp = new Date();

		req['local']['data-stack-txn-id'] = req.header('data-stack-txn-id');
		req['local']['data-stack-remote-txn-id'] = req.header('data-stack-remote-txn-id');
		req['local']['nodeName'] = '${nodeName}';
		req['local']['flowType'] = '${flowType}';
		req['local']['nodeType'] = '${nodeType}';
		req['local']['nodeId'] = '${node.meta.sequenceNo}';

		try {
			${node.meta.sourceFormat.formatType === 'XML' ?
        `	logger.debug('Parsing request body from XML to JSON');
					req.body = parse(req.body);
				`
        :
        ''
      }

			let interactionBlock = {
				timestamp: timestamp,
				createTimestamp: timestamp,
				completedTimestamp: new Date(),
				inputStructureID: '${node.meta.sourceFormat.id}',
				type: 'API',
				endpoint: '/api'
			};

			logger.trace('Interaction Block Data -> NodeName - ${nodeName} | NodeType - ${nodeType} - ', interactionBlock);

			global.dbPromises.push(upsertInteractionBlock(req, interactionBlock));

			logger.info('Successfully Processed Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${flowType}');

			next();

		} catch (err) {
			${getErrorBlock(node, 'API', 400)}
		}
	`;
}


function successFileInputMiddleware(node, lastNode) {

  let nodeType = 'INPUT';
  let nodeName = node.meta.name || `Node ${node.meta.sequenceNo}`;

  let conversionCode = `
    if (!req.files || Object.keys(req.files).length === 0) {
      res.status(400).send('No files were uploaded');
    }

    const reqFile = req.files.file;
    req['local']['tempFilePath'] = reqFile.tempFilePath;
    logger.trace('Request file info - ', reqFile);
	`;

  if (lastNode.meta.contentType === 'JSON') {
    conversionCode += `
      logger.debug('Parsing request file to JSON');

      let content = fs.readFileSync(reqFile.tempFilePath, 'utf-8');
      req.body = JSON.parse(content);
      content = null;

      next();
		`;
  } else if (lastNode.meta.contentType === 'XML') {
    conversionCode += `
      logger.debug('Parsing request file from XML to JSON');

      let content = fs.readFileSync(reqFile.tempFilePath, 'utf-8');
      req.body = parse(content);
      content = null;

      next();
		`;
  } else if (lastNode.meta.contentType === 'CSV' || lastNode.meta.contentType === 'DELIMITER' || lastNode.meta.contentType === 'EXCEL') {

    if (lastNode.meta.contentType === 'EXCEL') {
      conversionCode += `
				logger.debug('Parsing request file from ${lastNode.meta.contentType} to JSON');

				const wb = XLSX.readFile(path.join(reqFile.tempFilePath));
				XLSX.writeFile(wb, reqFile.tempFilePath, { bookType: 'csv' });
			`;
    }
    let delimiter = ',';
    if (lastNode.meta.contentType === 'DELIMITER') {
      delimiter = lastNode.meta.targetFormat.character;
    }

    let rowDelimiter = lastNode.meta.targetFormat.lineSeparator;
    if (rowDelimiter === '\\\\n') {
      rowDelimiter = '\\n';
    } else if (rowDelimiter === '\\\\r\\\\n') {
      rowDelimiter = '\\r\\n';
    } else if (rowDelimiter === '\\\\r') {
      rowDelimiter = '\\r';
    } else {
      rowDelimiter = '\\n';
    }

    conversionCode += `
			const fileStream = fs.createReadStream(reqFile.tempFilePath);
			let reqData = [];
			fastcsv.parseStream(fileStream, { headers: true, trim: true, rowDelimiter: '${rowDelimiter}', delimiter: '${delimiter}' })
			.on('error', err => {
				logger.error(err);
				${getErrorBlock(node, 'FILE', 500)}
			})
			.on('data', row => reqData.push(row))
			.on('end', rowCount => {
					logger.debug('Parsed rows = ', rowCount);
					req.body = reqData;
					logger.trace('Parsed Data - ', req.body);
					logger.info('Successfully Processed Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType}');

					next();
			});
		`;
  } else if (lastNode.meta.contentType === 'FLATFILE') {
    conversionCode += `logger.debug('Parsing request file from FLATFILE');`;

  } else if (lastNode.meta.contentType === 'BINARY') {
    conversionCode += `
      logger.debug('Parsing request file from BINARY');
      next();
    `;
  }

  return `
		logger.info('Starting Processing Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType}');
		logger.debug('Success Flow Request Received');
		logger.trace('Success Flow Request Body - ', JSON.stringify(req.files));
		logger.trace('Success Flow Header Data - ', JSON.stringify(req.headers));

		let timestamp = new Date();

		req['local']['data-stack-txn-id'] = req.header('data-stack-txn-id');
		req['local']['data-stack-remote-txn-id'] = req.header('data-stack-remote-txn-id');
		req['local']['nodeName'] = '${nodeName}';
		req['local']['flowType'] = '${node.meta.flowType}';
		req['local']['nodeType'] = '${nodeType}';
		req['local']['nodeId'] = '${node.meta.sequenceNo}';

		let interactionBlock = {
			timestamp: timestamp,
			createTimestamp: timestamp,
			completedTimestamp: new Date(),
			inputStructureID: '${node.meta.sourceFormat.id}',
			type: 'API',
			endpoint: '/api'
		};

		logger.trace('Interaction Block Data -> NodeName - ${nodeName} | NodeType - ${nodeType} - ', interactionBlock);

		global.dbPromises.push(upsertInteractionBlock(req, interactionBlock));

    try {
      ${conversionCode}

      logger.info('Successfully Processed Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType}');
    } catch (err) {
      ${getErrorBlock(node, 'FILE', 400)}
    }
	`;
}


function successOutputMiddleware(node) {

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

			${node.meta.contentType === 'XML' ?
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
					inputStructureID: '${node.meta.sourceFormat.id}',
					outputStructureID: '${node.meta.targetFormat.id}',
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
		${node.meta.contentType === 'XML' ?
      ` res.set('content-type', 'application/xml');
				res.status(statusCode).send(body);
			`
      :
      `	res.status(statusCode).json(body);`
    }
  `;
}


async function getSuccessContent(flowData) {

  const successPhases = flowData.successBlocks;

  if (successPhases && successPhases.length > 0) {

    const lastNode = flowData.blocks[flowData.blocks.length - 1];
    const { middlewares } = parseFlowJSON(successPhases, lastNode);

    return {
      content:
        `	const successRouter = require('express').Router();
					const { getErrorResponse, getSchemaErrors, postRequest } = require('../utils/flow.utils.js');
					const { upsertInteraction, upsertInteractionBlock } = require('../utils/db.utils.js');
					const _ = require('lodash');
					const fs = require('fs');
					const path = require('path');
					const fastcsv = require('fast-csv');
					const XLSX = require('xlsx');
					const { parse } = require('fast-xml-parser');
					const J2XParser = require('fast-xml-parser').j2xParser;
					const log4js = require('log4js');
					const request = require('request');

					if (process.env.NODE_ENV != 'production') {
						require('dotenv').config();
					}

					const config = require('../config');
					const flowData = require('../flow.json');

					let logger = global.logger;

					successRouter.use(async (req, res, next) => {
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

					${middlewares.map(e => `successRouter.use(async (req, res, next) => {${e}});`).join('\n\n')}

					module.exports = successRouter;
				`
    };
  } else {
    return {
      content:
        `	const successRouter = require('express').Router();

					const logger = global.logger;

					// Echo Server
					successRouter.use((req, res) => {
						logger.info('Processing Success Flow');

						logger.trace('Success Flow Request Body - ', JSON.stringify(req.body));
						logger.trace('Success Flow Request Header - ', JSON.stringify(req.headers));

						if (req.header('content-type') === 'application/json') {
							res.status(200).json(req.body);
						} else {
							res.status(200).send(req.body);
						}

						logger.info('Processed Success Flow');
					});

					module.exports = successRouter;
				`
    };
  }
}


module.exports = { getSuccessContent };
