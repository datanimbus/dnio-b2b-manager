const log4js = require('log4js');
const logger = log4js.getLogger('request.generator');

let stringOps = ['concat', 'substring', 'upper-case', 'lower-case', 'replace', 'contains'];
let numOps = ['+', '-', '*', 'ceiling', 'floor', 'round-half-to-even', 'div', 'mod'];
let arrOps = ['max', 'min', 'avg', 'sum'];

function parseFlowJSON(flowData) {

	logger.debug('Parsing Flow Request Blocks');

	let requestPhases = flowData.blocks;
	const middlewares = [];

	requestPhases.forEach(node => {

		let details = {
			flowType: node.meta.flowType,
			nodeType: node.meta.blockType,
			nodeId: node.meta.sequenceNo
		};

		if (node.meta.blockType === 'INPUT') {

			if (node.meta.sourceType === 'FILE') {
				middlewares.push(getFileInputMiddleware(node, flowData));
			} else {
				middlewares.push(getAPIInputMiddleware(node));
			}

			if (node.meta.contentType !== 'BINARY' && node.meta.sourceFormat.strictValidation) {
				middlewares.push(getSchemaValidationMiddleware(node, node.source));
			}

		} else if (node.meta.blockType === 'PROCESS' && node.meta.processType === 'REQUEST') {

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

			if (node.meta.sourceFormat.formatType !== 'BINARY' && node.meta.sourceFormat.strictValidation) {
				middlewares.push(getSchemaValidationMiddleware(node, node.source));
			}

			if (node.meta.sourceType === 'FILE') {
				middlewares.push(getFileOutputMiddleware(node, details, flowData));
			} else {
				middlewares.push(getAPIOutputMiddleware(node));
			}
		}
	});

	return {
		middlewares
	};
}


function getAPIInputMiddleware(node) {

	let nodeType = (node.meta.blockType === 'PROCESS') ? node.meta.processType : node.meta.blockType;
	let nodeName = node.meta.name || `Node ${node.meta.sequenceNo}`;

	return `
		logger.info(\`Starting Processing Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);

		logger.trace('Request Body - ', JSON.stringify(req.body));
		logger.trace('Request Headers - ', JSON.stringify(req.headers));

		let timestamp = new Date();

		req['local']['nodeName'] = '${nodeName}';
		req['local']['flowType'] = '${node.meta.flowType}';
		req['local']['nodeType'] = '${nodeType}';
    	req['local']['nodeId'] = '${node.meta.sequenceNo}';

		Object.keys(req.headers).forEach(key => {
			if (key.includes("Data-Stack-") || key.includes("data-stack-") || key.includes("data-Stack-") || key.includes("Data-stack-")) {
				req['local']['headers'][key] = req.headers[key];
			}
		});

		${node.meta.contentType === 'XML' ?
			`	try {
					logger.debug('Parsing request body from XML to JSON')

					req.body = parse(req.body);

				} catch(err) {
        			${getErrorBlock(node, 'API', 400)}
				}
			`
			:
			``
		}

		let interaction = {
			dataStackTxnId: req['local']['data-stack-txn-id'],
			remoteTxnId: req['local']['data-stack-remote-txn-id'],
			flowId: config.dataStackFlowId,
			partnerId: config.dataStackPartnerId,
			appName: config.dataStackAppName,
			direction: config.dataStackFlowDirection,
			timestamp: timestamp,
			createTimestamp: timestamp,
			completedTimestamp: new Date(),
			status: 'PENDING'
		};

		let interactionBlock = {
			timestamp: timestamp,
			createTimestamp: timestamp,
			completedTimestamp: new Date(),
      		inputStructureID: '${node.meta.sourceFormat.id || ''}',
      		outputStructureID: '${node.meta.targetFormat.id || ''}',
      		type: 'API',
			endpoint: '/api',
      		statusCode: 200,
			two_way_ssl: '${node.meta.connectionDetails.twoWaySSL || ''}',
			connectionType: '${node.meta.connectionDetails.connectionType || ''}'
		};

		logger.trace('Interaction Data -> NodeName - ${nodeName} | NodeType - ${nodeType} - ', interaction);
		logger.trace('Interaction Block Data -> NodeName - ${nodeName} | NodeType - ${nodeType} - ', interactionBlock);

		global.dbPromises.push(upsertInteraction(req, interaction));
		global.dbPromises.push(upsertInteractionBlock(req, interactionBlock));

		logger.info(\`Successfully Processed Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);
		next();
	`;
}


function getFileInputMiddleware(node, flowData) {

	let nodeType = (node.meta.blockType === 'PROCESS') ? node.meta.processType : node.meta.blockType;
	let nodeName = node.meta.name || `Node ${node.meta.sequenceNo}`;

	const mappings = [];
	const sourceSchema = require(`../../../generatedFlows/${flowData.flowID}/schemas/${node.source}.schema.json`);

	Object.keys(sourceSchema.properties).forEach(key => {
		mappings.push(`_.set(rightData, '${key}', _.get(leftData, '${key}')); `);
	});

	let conversionCode = `
    if (!req.files || Object.keys(req.files).length === 0) {
      res.status(400).send('No files were uploaded');
    }

    const reqFile = req.files.file;
    req['local']['tempFilePath'] = reqFile.tempFilePath;
    logger.trace('Request file info - ', reqFile);
  `;

	if (node.meta.contentType === 'JSON') {
		conversionCode += `
      logger.debug('Parsing request file to JSON');

      let content = fs.readFileSync(reqFile.tempFilePath, 'utf-8');
      req.body = JSON.parse(content);
      content = null;

      next();
	`;
	} else if (node.meta.contentType === 'XML') {
		conversionCode += `
      logger.debug('Parsing request file to XML');

      let content = fs.readFileSync(reqFile.tempFilePath, 'utf-8');
      req.body = parse(content);
      content = null;

      next();
	`;
	} else if (node.meta.contentType === 'CSV' || node.meta.contentType === 'DELIMITER' || node.meta.contentType === 'EXCEL') {
		if (node.meta.contentType === 'EXCEL') {
			const code = [`logger.debug('Parsing request file to ${node.meta.contentType}');`];

			if (node.meta.fileDetails.password) {
				code.push(`try {`)
				code.push(`const tempWB = await xlsxPopulate.fromFileAsync(path.join(reqFile.tempFilePath), { password: '${node.meta.fileDetails.password}' });`);
				code.push(`await tempWB.toFileAsync(path.join(reqFile.tempFilePath));`);
				code.push(`} catch (e) {`)
				code.push(`const err = {`);
				code.push(`statusCode: 400,`);
				code.push(`message: 'Incorrect Password'`);
				code.push(`};`);
				code.push(`${getErrorBlock(node, 'FILE', 400)}`)
				code.push(`}`)
			}

			code.push(`const wb = XLSX.readFile(path.join(reqFile.tempFilePath));`);
			code.push(`XLSX.writeFile(wb, reqFile.tempFilePath, { bookType: 'csv' });`);
			conversionCode += code.join('\n');
		}

		let delimiter = ',';
		if (node.meta.contentType === 'DELIMITER') {
			delimiter = node.meta.targetFormat.character;
		}

		let rowDelimiter = node.meta.targetFormat.lineSeparator;
		if (rowDelimiter === '\\\\n') {
			rowDelimiter = '\\n';
		} else if (rowDelimiter === '\\\\r\\\\n') {
			rowDelimiter = '\\r\\n';
		} else if (rowDelimiter === '\\\\r') {
			rowDelimiter = '\\r';
		} else {
			rowDelimiter = '\\n';
		}

		let skipEndRowsCode = '';
		if (node.meta.skipEndRows != undefined && node.meta.skipEndRows > 0) {
			skipEndRowsCode += `req.body = reqData.splice(0, reqData.length - ${node.meta.skipEndRows});`;
		} else {
			skipEndRowsCode += `req.body = reqData;`;
		}

		conversionCode += `
		const fileStream = fs.createReadStream(reqFile.tempFilePath);
		let reqData = [];
		fastcsv.parseStream(fileStream, {
			headers: fileUtils.getHeaderOf${node.source}(),
			skipLines: ${node.meta.skipStartRows || 0},
			rowDelimiter: '${rowDelimiter}',
			delimiter: '${delimiter}',
			${node.meta.sourceFormat.strictValidation ? `strictColumnHandling: true` : `discardUnmappedColumns: true`}
		})
		.transform(row => {
			let schema = require(path.join(process.cwd(), 'schemas', '${node.source}.schema.json'));
			for (property in schema.properties) {
				if (schema.properties[property].type.includes('number') || schema.properties[property].type.includes('integer')) {
					row[property] = Number(row[property]);
				}
			}
			return row;
		})
		.on('error', err => {
			${getErrorBlock(node, 'FILE', 400)}
		})
		.on('data', row => reqData.push(row))
		.on('end', rowCount => {
			logger.debug('Parsed rows = ', rowCount);
			${skipEndRowsCode}
			logger.trace('Parsed Data - ', req.body);
			logger.info(\`Successfully Processed Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);
			next();
		});
	`;
	} else if (node.meta.contentType === 'FLATFILE') {

		let skipEndRowsCode = '';
		if (node.meta.skipEndRows != undefined && node.meta.skipEndRows > 0) {
			skipEndRowsCode += `req.body = reqData.splice(0, reqData.length - ${node.meta.skipEndRows});`;
		} else {
			skipEndRowsCode += `req.body = reqData;`;
		}

		conversionCode += `
			logger.debug('Parsing request file to FLATFILE');

			const fileStream = fs.createReadStream(reqFile.tempFilePath);
			let reqData = [];
			fastcsv.parseStream(fileStream, {
				skipLines: ${node.meta.skipStartRows || 0}
			})
			.transform(row => {
				return fileUtils.readFlatFile${node.source}(row.join());
			})
			.on('error', err => {
				${getErrorBlock(node, 'FILE', 400)}
			})
			.on('data', row => reqData.push(row))
			.on('end', rowCount => {
				logger.debug('Parsed rows = ', rowCount);
				${skipEndRowsCode}
				logger.trace('Parsed Data - ', req.body);
				logger.info(\`Successfully Processed Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);
				next();
			});
		`;
	} else if (node.meta.contentType === 'BINARY') {
		conversionCode += `
      fs.copyFileSync(reqFile.tempFilePath, path.join(process.cwd(), 'downloads', req['local']['output-file-name']));
      next();
    `;
	}

	return `
		logger.info(\`Starting Processing Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);

		logger.trace('Request Files - ', JSON.stringify(req.files));
    logger.trace('Header Data - ', JSON.stringify(req.headers));

    req['local']['nodeName'] = '${nodeName}';
		req['local']['flowType'] = '${node.meta.flowType}';
		req['local']['nodeType'] = '${nodeType}';
		req['local']['nodeId'] = '${node.meta.sequenceNo}';
    req['local']['output-file-name'] = req.header('data-stack-remote-txn-id');

		Object.keys(req.headers).forEach(key => {
			if (key.includes("Data-Stack-") || key.includes("data-stack-") || key.includes("data-Stack-") || key.includes("Data-stack-")) {
				req['local']['headers'][key] = req.headers[key];
			}
		});

		let timestamp = new Date();

    try {
			${conversionCode}
			logger.info(\`Successfully Processed Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);
    } catch (err) {
      ${getErrorBlock(node, 'FILE', 400)}
    }
	`;
}


function getAPIOutputMiddleware(node) {

	let nodeType = (node.meta.blockType === 'PROCESS') ? node.meta.processType : node.meta.blockType;
	let nodeName = node.meta.name || `Node ${node.meta.sequenceNo}`;

	let customHeaders = node.meta.customHeaders;

	for (h in customHeaders) {
		customHeaders[h.toLowerCase()] = customHeaders[h]
		delete (customHeaders[h]);
	}

	return `
		logger.info(\`Starting Processing Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);

		logger.trace('Output Request Body - ', JSON.stringify(req.body));
		logger.trace('Output Request Headers - ', JSON.stringify(req.headers));

		let timestamp = new Date();

		try {
			req['local']['nodeName'] = '${nodeName}';
			req['local']['flowType'] = '${node.meta.flowType}';
			req['local']['nodeType'] = '${nodeType}';
			req['local']['nodeId'] = '${node.meta.sequenceNo}';

			let headers = { ...${JSON.stringify(customHeaders)}, ...req['local']['headers'] };

			${node.meta.contentType === 'XML' ?
			`	logger.debug('Parsing Output data from JSON to XML');

          req.body = new J2XParser().parse(req.body);

          headers['content-type'] = 'application/xml';

          logger.debug('Connection type - ${node.meta.connectionDetails['connectionType']}');

          ${getAuthMiddleware(node, node.meta.connectionDetails)}

          let postResponse = await postRequest(options, false);

          logger.debug('Response received from url - ', options.url);
          logger.trace('Response Body - ', JSON.stringify(postResponse.body));
          logger.trace('Response Headers - ', JSON.stringify(postResponse.headers));

          if (postResponse.statusCode > 199 && postResponse.statusCode < 300) {
            let options = {
              url: config.successFlowUrl,
              body: postResponse.body,
              headers: headers
            };

            let response = await postRequest(options, false);
        `
			:
			`	logger.debug('Connection type - ${node.meta.connectionDetails['connectionType']}');

          ${getAuthMiddleware(node, node.meta.connectionDetails)}

          ${node.meta.sourceFormat.formatType === 'BINARY' ?
				` let postResponse = await postRequest(options, false);`
				:
				` let postResponse = await postRequest(options);`
			}

          logger.debug('Response received from url - ', options.url);
          logger.trace('Response Body - ', JSON.stringify(postResponse.body));
          logger.trace('Response Headers - ', JSON.stringify(postResponse.headers));

          if (postResponse.statusCode > 199 && postResponse.statusCode < 300) {
            let options = {
              url: config.successFlowUrl,
              body: postResponse.body,
              headers: headers
            };

            let flag = false;
            if (postResponse.body && typeof postResponse.body == 'object') {
              flag = true;
            }

            let response = await postRequest(options, flag);
        `
		}
	  		  logger.debug('Response received from url - ', options.url);
		    	logger.trace('Response Body - ', JSON.stringify(postResponse.body));
  			  logger.trace('Response Headers - ', JSON.stringify(postResponse.headers));

    			let interaction = {
	    			dataStackTxnId: req['local']['data-stack-txn-id'],
		    		remoteTxnId: req['local']['data-stack-remote-txn-id'],
			    	flowId: config.dataStackFlowId,
				    partnerId: config.dataStackPartnerId,
    				appName: config.dataStackAppName,
	    			direction: config.dataStackFlowDirection,
		    		timestamp: timestamp,
			    	completedTimestamp: new Date(),
				    status: 'SUCCESS'
    			};

	    		let interactionBlock = {
		    		timestamp: timestamp,
			    	createTimestamp: timestamp,
				    completedTimestamp: new Date(),
  				  inputStructureID: '${node.meta.sourceFormat.id}',
  	  			type: 'API',
	  	  		url: '${node.meta.connectionDetails.url}',
		  	  	statusCode: 200,
			  	  two_way_ssl: '${node.meta.connectionDetails.twoWaySSL || ''}',
  			  	connectionType: '${node.meta.connectionDetails.connectionType || ''}'
  	  		};

	  	  	logger.trace('Interaction Data - NodeName - ${nodeName} | NodeType - ${nodeType} - ', interaction);
		  	  logger.trace('Interaction Block Data - NodeName - ${nodeName} | NodeType - ${nodeType} - ', interactionBlock);

  		  	global.dbPromises.push(upsertInteraction(req, interaction));
	  		  global.dbPromises.push(upsertInteractionBlock(req, interactionBlock));

  		  	${node.meta.contentType === 'XML' ?
			`	res.set('content-type', 'application/xml');
		  		    res.status(response.statusCode).send(response.body);
  		  	  `
			:
			` res.status(response.statusCode).json(response.body);`
		}

		  	  logger.info(\`Successfully Processed Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);

  			} else {
	  			let err = {
		  			statusCode: postResponse.statusCode,
			  		message: postResponse.body
          }
  				logger.info('Response with non 200 status code received, throwing error');
	  			${getErrorBlock(node, 'API', 400)}
		  	}
		} catch (err) {
      ${getErrorBlock(node, 'API', 500)}
		}
	`;
}


function getFileOutputMiddleware(node, details, flowData) {

	let nodeType = (node.meta.blockType === 'PROCESS') ? node.meta.processType : node.meta.blockType;
	let nodeName = node.meta.name || `Node ${node.meta.sequenceNo}`;

	const uploadFileCode = `
		const uploadStream = fs.createReadStream(uploadFilePath);

		let options = {
			headers: reqHeaders,
			url: 'http://b2bgw-internal.${process.env.DATA_STACK_NAMESPACE}/b2b-upload',
			formData: {
				file: uploadStream
			}
		};

		let response = await postRequest(options, false);

		logger.debug('Response received from url - ', options.url);
		logger.trace('Response Body - ', JSON.stringify(response.body));
		logger.trace('Response Headers - ', JSON.stringify(response.headers));

		res.status(response.statusCode).json(response.body);

		logger.info(\`File Processing & Upload to B2BGW Success -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);
	`;

	let fileType = node.meta.contentType.toLowerCase();
	if (node.meta.contentType === 'EXCEL') {
		fileType = node.meta.fileDetails.excelType.toLowerCase();
	}

	const successPhases = flowData.successBlocks;
	let isSuccessBlocksPresent = false;
	if (successPhases && successPhases.length > 0) {
		isSuccessBlocksPresent = true;
	}

	let outputDirectory = '';
	if (node.meta.outputDirectories != null && node.meta.outputDirectories.length != 0) {
		outputDirectory = JSON.stringify(node.meta.outputDirectories);
		outputDirectory = outputDirectory.replace(/"/g, '\\\"');

	} else if (node.meta.outputDirectory != null && node.meta.outputDirectory !== '') {
		outputDirectory = JSON.stringify(node.meta.outputDirectory);
		outputDirectory = outputDirectory.replace(/\\/g, '\\\\');
	}

	let conversionCode = ``;

	if (node.meta.contentType === 'CSV' || node.meta.contentType === 'DELIMITER' || node.meta.contentType === 'EXCEL') {

		let delimiter = ',';
		if (node.meta.contentType === 'DELIMITER') {
			delimiter = node.meta.targetFormat.character;
		}

		let rowDelimiter = node.meta.targetFormat.lineSeparator;
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
		  const csvOutputStream = fs.createWriteStream(uploadFilePath);
  		const stream = fastcsv.format({ rowDelimiter: '${rowDelimiter}', delimiter: '${delimiter}', ${node.meta.contentType === 'DELIMITER' ? 'quote: false' : ''} });
	  	stream.pipe(csvOutputStream);
		  const generateHeaders = ${node.meta.generateHeaders || false};

      if (generateHeaders) {
	  		stream.write(fileUtils.getHeaderOf${node.target}());
		  }

      if (Array.isArray(req.body)) {
	  		req.body.forEach(data => {
		  		stream.write(fileUtils.getValuesOf${node.target}(data));
			  });
  		} else {
	  		stream.write(fileUtils.getValuesOf${node.target}(req.body));
      }

  		stream.end();
      csvOutputStream.on('close', async function() {
    `;

		if (node.meta.contentType === 'EXCEL') {
			conversionCode += `
        const wb = XLSX.readFile(uploadFilePath, { raw: true });
			  XLSX.writeFile(wb, uploadFilePath, { bookType: '${node.meta.targetFormat.excelType.toLowerCase()}', type: 'string' });
			`;
		}

		conversionCode += `${uploadFileCode}\n});`;

	} else if (node.meta.contentType === 'FLATFILE') {

		conversionCode += `
  		const csvOutputStream = fs.createWriteStream(uploadFilePath);
	  	const stream = fastcsv.format({ delimiter: '""' });
	  	stream.pipe(csvOutputStream);

  		if (Array.isArray(req.body)) {
	  		req.body.forEach(data => {
		  		stream.write([fileUtils.writeFlatFile${node.target}(data)]);
			  });
  		} else {
	  		stream.write([fileUtils.writeFlatFile${node.target}(req.body)]);
		  }

      stream.end();
	  	csvOutputStream.on('close', async function() {
    `;
		conversionCode += `${uploadFileCode}\n});`;

	} else if (node.meta.contentType === 'BINARY') {
		conversionCode += `${uploadFileCode}`;

	} else if (node.meta.contentType === 'JSON') {
		conversionCode += `
		  fs.writeFileSync(uploadFilePath, JSON.stringify(req.body), 'utf-8');
		  ${uploadFileCode}
    `;

	} else if (node.meta.contentType === 'XML') {
		conversionCode += `
  		const content = new J2XParser().parse(req.body);
	  	fs.writeFileSync(uploadFilePath, content, 'utf-8');
		  ${uploadFileCode}
		`;
	}

	return `
		logger.info(\`Starting File Processing Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);

		logger.trace('Output Request Body - ', JSON.stringify(req.body));
    logger.trace('Output Request Headers - ', JSON.stringify(req.headers));

		req['local']['nodeName'] = '${nodeName}';
	 	req['local']['flowType'] = '${node.meta.flowType}';
		req['local']['nodeType'] = '${nodeType}';
		req['local']['nodeId'] = '${node.meta.sequenceNo}';

		let fileName = '';
		if (req['local']['output-file-name'] != null && req['local']['output-file-name'] != '') {
			fileName = req['local']['output-file-name'];
		} else {
			if (req.header('data-stack-remote-txn-id').includes('.')) {
				fileName = req.header('data-stack-remote-txn-id').toString();
			} else {
				fileName = req.header('data-stack-remote-txn-id')+'.'+'${fileType}';
			}
		}
		const uploadFilePath = path.join(process.cwd(),'downloads', fileName);

		let timestamp = new Date();

		try {
			let reqHeaders = {
				'output-agent-id': '${node.meta.target}',
				'data-stack-app-name': config.dataStackAppName,
				'data-stack-flow-name': config.dataStackFlowName,
				'data-stack-flow-id': config.dataStackFlowId,
				'data-stack-partner-id': config.dataStackPartnerId,
				'data-stack-partner-name': config.dataStackPartnerName,
				'data-stack-deployment-name': config.dataStackDeploymentName,
				'file-type': '${fileType}',
				'sequence-number': '${node.meta.sequenceNo}',
				'block-name': '${nodeName}',
				'target-data-format': '${node.meta.targetFormat.id}',
				'output_directory': '${outputDirectory}',
				'success-block': ${isSuccessBlocksPresent},
				'data-stack-mirror-directory': req.header('data-stack-mirror-directory') || '',
				'data-stack-operating-system': req.header('data-stack-operating-system') || '',
				'data-stack-file-output-dir': req.header('data-stack-file-output-dir') || '',
				'data-stack-file-output-name': fileName,
				'data-stack-remote-txn-id': req.header('data-stack-remote-txn-id'),
				'data-stack-txn-id': req.header('data-stack-txn-id')
			};

			logger.trace('Request Headers - ', JSON.stringify(reqHeaders));

			${conversionCode}

		} catch (err) {
			${getErrorBlock(node, 'FILE', 502)}
		}
	`;
}


function getSchemaValidationMiddleware(node, schemaId) {
	let nodeType = (node.meta.blockType === 'PROCESS') ? node.meta.processType : node.meta.blockType;
	let nodeName = node.meta.name || `Node ${node.meta.sequenceNo}`;
	let flowType = node.meta.flowType;

	let name = node.meta.sourceFormat.name;
	if (node.target == schemaId) {
		name = node.meta.targetFormat.name;
	}

	return `
		logger.info(\`Starting Schema Validation -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);

		req['local']['nodeName'] = '${nodeName}';
		req['local']['flowType'] = '${flowType}';
		req['local']['nodeType'] = '${nodeType}';
		req['local']['nodeId'] = '${node.meta.sequenceNo}';

		let timestamp = new Date();

		logger.debug('Validating Schema - ${name}');

		let err = getSchemaErrors('${schemaId}', req.body);

		if (!err) {
			logger.debug('Schema Validated Successfully - ${name}');
			logger.info(\`Successfully Validated Schema -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);

      next();

		} else {
			${getErrorBlock(node, 'Schema', 400)}
		}
	`;
}


function getProcessRequestMiddleware(node) {

	let nodeType = (node.meta.blockType === 'PROCESS') ? node.meta.processType : node.meta.blockType;
	let nodeName = node.meta.name || `Node ${node.meta.sequenceNo}`;

	let connectionDetails = node.meta.connectionDetails;
	let customHeaders = node.meta.customHeaders;

	for (h in customHeaders) {
		customHeaders[h.toLowerCase()] = customHeaders[h]
		delete (customHeaders[h]);
	}

	let type = 'nanoService';
	if (node.meta.dataFormat && node.meta.dataFormat === 'dataService') {
		type = 'dataService';
	}

	return `
		logger.info(\`Starting Processing Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);

		req['local']['nodeName'] = '${nodeName}';
		req['local']['flowType'] = '${node.meta.flowType}';
		req['local']['nodeType'] = '${nodeType}';
		req['local']['nodeId'] = '${node.meta.sequenceNo}';

		let timestamp = new Date();

		try {
			let headers = { ...${JSON.stringify(customHeaders)}, ...req['local']['headers'] };

			req['local']['headers'] = headers;

			delete (headers['transfer-encoding']);
			${node.meta.sourceFormat.formatType !== 'BINARY' ? `headers['Content-Type'] = 'application/json';` : ''}

			logger.trace('Request Body - ', JSON.stringify(req.body));
			logger.trace('Request Headers - ', JSON.stringify(headers));
			logger.debug('Connection type - ${connectionDetails['connectionType']}');

			${getAuthMiddleware(node, connectionDetails)}
			${node.meta.sourceFormat.formatType !== 'BINARY' ? `options.json = true;` : 'options.json = false;'}
			${node.meta.targetFormat.formatType !== 'BINARY' ? getJSONProcessRequest(node, nodeName, nodeType) : getBinaryProcessRequest(node, nodeName, nodeType)}
			logger.info(\`Successfully Processed Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);
		} catch(err) {
			${getErrorBlock(node, type, 502)}
		}
	`;
}


function getJSONProcessRequest(node, nodeName, nodeType) {

	let type = 'nanoService';
	if (node.meta.dataFormat && node.meta.dataFormat === 'dataService') {
		type = 'dataService';
	}

	return `
		let response = await postRequest(options, options.json);

		logger.debug('Response received from url - ', options.url);
		logger.trace('Response Body - ', JSON.stringify(response.body), response.statusCode);
		logger.trace('Response Headers - ', JSON.stringify(response.headers));

		try {
			response.body = JSON.parse(response.body);
		} catch(err) {
		}

		if (response.statusCode > 199 && response.statusCode < 300) {

			let newHeaders = { ...req['local']['headers'] };
			Object.keys(response.headers).forEach(key => {
				if (key.includes("Data-Stack-") || key.includes("data-stack-") || key.includes("data-Stack-") || key.includes("Data-stack-")) {
					newHeaders[key] = response.headers[key];
				}
			});

			newHeaders['data-stack-txn-id'] = req['local']['data-stack-txn-id'];
			newHeaders['data-stack-remote-txn-id'] = req['local']['data-stack-remote-txn-id'];
			newHeaders['data-stack-mirror-directory'] = req['local']['data-stack-mirror-directory'] || '';
			newHeaders['data-stack-operating-system'] = req['local']['data-stack-operating-system'] || '';
			newHeaders['data-stack-deployment-name'] = req['local']['data-stack-deployment-name'] || '';
			newHeaders['data-stack-file-md5'] = req['local']['data-stack-file-md5'] || '';
			newHeaders['data-stack-file-ext'] = req['local']['data-stack-file-ext'] || '';
			newHeaders['data-stack-file-name'] = req['local']['data-stack-file-name'] || '';
			newHeaders['data-stack-file-size'] = req['local']['data-stack-file-size'] || '';
			newHeaders['data-stack-nano-service'] = req['local']['data-stack-nano-service'] || '';
			newHeaders['data-stack-flow'] = req['local']['data-stack-flow'] || '';

			const outputFileHeader = Object.keys(newHeaders).find(e=>e.toLowerCase()==='data-stack-file-output-name');
			if(!outputFileHeader) {
				newHeaders['data-stack-file-output-name'] = req['local']['output-file-name'] || '';
			} else {
				req['local']['output-file-name'] = newHeaders[outputFileHeader];
			}

			req.body = response.body;
			req['local']['headers'] = newHeaders;

			let interactionBlock = {
				timestamp: timestamp,
				createTimestamp: timestamp,
				completedTimestamp: new Date(),
				inputStructureID: '${node.meta.sourceFormat.id || ''}',
				outputStructureID: '${node.meta.targetFormat.id || ''}',
				type: '${type}',
				serviceID: '${node.meta.formatId}',
				serviceName: '${node.meta.formatName}',
				url: '${node.meta.connectionDetails.url}',
				connectionType: '${node.meta.connectionDetails.connectionType}',
				statusCode: response.statusCode
			};

			logger.trace('Interaction Block Data - NodeName - ${nodeName} | NodeType - ${nodeType} - ', interactionBlock);

			global.dbPromises.push(upsertInteractionBlock(req, interactionBlock));

			logger.info(\`Successfully Processed Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);

			req['local']['statusCode'] = response.statusCode;
			req['local']['body'] = response.body;

			next();

		} else {
			logger.info('Response with a non 200 status code received, throwing error');
			let err = {
				statusCode: response.statusCode,
				message: response.body
			};
			${getErrorBlock(node, node.meta.formatType, 400)}
		}
	`;
}


function getBinaryProcessRequest(node, nodeName, nodeType) {

	let type = 'nanoService';
	if (node.meta.dataFormat && node.meta.dataFormat === 'dataService') {
		type = 'dataService';
	}

	let fileType = node.meta.contentType ? node.meta.contentType.toLowerCase() : 'bin';

	return `
		const resFilePath = path.join(process.cwd(), 'downloads', req['local']['data-stack-remote-txn-id']);
		const resFileStream = fs.createWriteStream(resFilePath);
		let errorOccured = false;

		logger.debug('Making a POST request to url - ', options.url);
		logger.trace('Request options - ', JSON.stringify(options));

		request(options, (err, response)=> {
			if (err) {
				errorOccured = true;
				logger.error('Error while trying to request to ${node.meta.connectionDetails.url}, throwing error');
				${getErrorBlock(node, node.meta.formatType, 400)}
			}

			logger.debug('Response received from url - ', options.url);
			logger.trace('Response Body - ', JSON.stringify(response.body), response.statusCode);
			logger.trace('Response Headers - ', JSON.stringify(response.headers));

			if (response.statusCode > 199 && response.statusCode < 300) {

				let newHeaders = { ...req['local']['headers'] };
				Object.keys(response.headers).forEach(key => {
					if (key.includes("data-stack-") || key.includes("Data-Stack-") || key.includes("data-Stack-") || key.includes("Data-stack-")) {
						newHeaders[key] = response.headers[key];
					}
				});

				newHeaders['data-stack-txn-id'] = req['local']['data-stack-txn-id'];
				newHeaders['data-stack-remote-txn-id'] = req['local']['data-stack-remote-txn-id'];
				newHeaders['data-stack-mirror-directory'] = req['local']['data-stack-mirror-directory'] || '';
				newHeaders['data-stack-operating-system'] = req['local']['data-stack-operating-system'] || '';
				newHeaders['data-stack-deployment-name'] = req['local']['data-stack-deployment-name'] || '';
				newHeaders['data-stack-file-md5'] = req['local']['data-stack-file-md5'] || '';
				newHeaders['data-stack-file-ext'] = req['local']['data-stack-file-ext'] || '';
				newHeaders['data-stack-file-name'] = req['local']['data-stack-file-name'] || '';
				newHeaders['data-stack-file-size'] = req['local']['data-stack-file-size'] || '';
				newHeaders['data-stack-nano-service'] = req['local']['data-stack-nano-service'] || '';
				newHeaders['data-stack-flow'] = req['local']['data-stack-flow'] || '';

				const outputFileHeader = Object.keys(newHeaders).find(e=>e.toLowerCase()==='data-stack-file-output-name');
				if(!outputFileHeader){
					newHeaders['datastack-file-output-name'] = req['local']['output-file-name'] || '';
				} else {
					req['local']['output-file-name'] = newHeaders[outputFileHeader];
				}

				req['local']['headers'] = newHeaders;

				let interactionBlock = {
					blockName: '${node.meta.name || ''}',
					timestamp: timestamp,
					createTimestamp: timestamp,
					completedTimestamp: new Date(),
					inputStructureID: '${node.meta.sourceFormat.id || ''}',
					outputStructureID: '${node.meta.targetFormat.id || ''}',
					type: '${type}',
					serviceID: '${node.meta.formatId}',
					serviceName: '${node.meta.formatName}',
					url: '${node.meta.connectionDetails.url}',
					connectionType: '${node.meta.connectionDetails.connectionType}',
					statusCode: response.statusCode
				};

				logger.trace('Interaction Block Data - NodeName - ${nodeName} | NodeType - ${nodeType} - ', interactionBlock);

				global.dbPromises.push(upsertInteractionBlock(req, interactionBlock));

				logger.info(\`Successfully Processed Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);

			} else {
				errorOccured = true;
				logger.info('Response with non 200 status code received, throwing error');
				let err = {
					statusCode: response.statusCode,
					message: response.body
				};
				${getErrorBlock(node, node.meta.formatType, 400)}
			}
		}).pipe(resFileStream);

		resFileStream.on('close', () => {
			if (!errorOccured) {
				let fileName = '';
				if (req['local']['output-file-name'] != null && req['local']['output-file-name'] != '') {
					fileName = req['local']['output-file-name'];
				} else {
					if (req.header('data-stack-remote-txn-id').includes('.')) {
						fileName = req.header('data-stack-remote-txn-id').toString();
					} else {
						fileName = req.header('data-stack-remote-txn-id')+'.'+'${fileType}';
					}
				}

				const outputFilePath = path.join(process.cwd(), 'downloads', fileName);
				fs.renameSync(resFilePath, outputFilePath);
				req['local']['tempFilePath'] = outputFilePath;
				next();
			}
		});

		resFileStream.on('error', (err) => {
			logger.info('Error while streaming response data, throwing error');
			${getErrorBlock(node, node.meta.formatType, 400)}
		});
	`;
}


function getAuthMiddleware(node, connectionDetails) {

	let timeout = connectionDetails.requestTimeout;
	let trustAllCerts = connectionDetails.trustAllCerts;
	let serverCert = connectionDetails.serverCertificate ? Buffer.from(connectionDetails.serverCertificate, 'base64').toString() : null;

	let code = `
    let options = {
			method: 'post',
			url: '${connectionDetails.url}',
			headers: headers
    };
  `;

	if (timeout && timeout > 0) {
		code += ` options.timeout = ${timeout};`;
	}

	if (node.meta.sourceFormat.formatType === 'BINARY') {
		// code += `options.formData = {
		// 	file: fs.createReadStream(req['local']['tempFilePath'])
		// };`;
		code += `
			if (req['local']['data-stack-file-ext'].toLowerCase() === 'xls' || req['local']['data-stack-file-ext'].toLowerCase() === 'xlsx') {
				options.body = XLSX.readFile(path.join(req['local']['tempFilePath'] || req.files.file.tempFilePath));
				options.headers['Content-Type'] = 'application/octet-stream';
			} else {
				options.body = fs.readFileSync(req['local']['tempFilePath'] || req.files.file.tempFilePath, 'utf-8');
      			options.headers['Content-Type'] = 'application/octet-stream';
			}
    `;
	} else {
		code += ' options.body = req.body;';
	}

	if (connectionDetails.connectionType === 'CERTIFICATE-KEY') {
		code += ` ${serverCert ? `options.ca=\`${serverCert}\`;` : ``}`;

		if (connectionDetails.sslType === 'TWO-WAY') {
			let cert = Buffer.from(connectionDetails.clientCertificate, 'base64').toString();
			let key = Buffer.from(connectionDetails.clientKey, 'base64').toString();
			code += ` options.cert = \`${cert}\`;`;
			code += ` options.key = \`${key}\`;`;
		}
		code += ` options.requestCert = true;`;
		code += ` options.rejectUnauthorized = false;`;

	} else {
		code += ` options.rejectUnauthorized = false;`;
	}
	return code;
}


function getTransformMiddleware(node) {

	let nodeType = (node.meta.blockType === 'PROCESS') ? node.meta.processType : node.meta.blockType;
	let nodeName = node.meta.name || `Node ${node.meta.sequenceNo}`;

	let xslt = node.meta.xslt;

	if (typeof xslt == 'string') {
		xslt = JSON.parse(xslt);
	}

	const mappingObject = getMappingKeys(xslt);
	const headerMappingObject = getHeaderMappingKeys(xslt);

	const mappings = [];
	const headerMappings = [];

	Object.keys(mappingObject).forEach(key => {
		if (typeof mappingObject[key] === 'string') {
			mappings.push(`_.set(rightData, '${key}', ${mappingObject[key]});`);
		} else if (Array.isArray(mappingObject[key])) {
			let data = mappingObject[key].join('');
			mappings.push(`_.set(rightData, '${key}', ${data});`);
		} else {
			mappings.push(mappingObject[key].code);
		}
	});

	Object.keys(headerMappingObject).forEach(key => {
		headerMappings.push(`_.set(newHeaders, '${key}', (_.get(req['local']['headers'], '${headerMappingObject[key]}') || null));`);
	});

	return `
		logger.info(\`Starting Transformation Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);

		req['local']['nodeName'] = '${nodeName}';
		req['local']['flowType'] = '${node.meta.flowType}';
		req['local']['nodeType'] = '${nodeType}';
		req['local']['nodeId'] = '${node.meta.sequenceNo}';

		let timestamp = new Date();

		logger.debug('Transforming from ${node.meta.sourceFormat.name} to ${node.meta.targetFormat.name}');
		logger.trace('In Data - ', JSON.stringify(req.body));
		logger.trace('In Headers - ', JSON.stringify(req['local']['headers']));

		let newHeaders = {...req['local']['headers']};

		newHeaders['data-stack-file-output-dir'] = req['local']['headers']['data-stack-file-output-dir'] || '';
		newHeaders['data-stack-file-output-name'] = req['local']['headers']['data-stack-file-output-name'] || '';

		//Headers Transformation
		${headerMappings.join('\n\t\t\t\t')}

		newHeaders['data-stack-txn-id'] = req['local']['data-stack-txn-id'];
		newHeaders['data-stack-remote-txn-id'] = req['local']['data-stack-remote-txn-id'];
		newHeaders['data-stack-mirror-directory'] = req['local']['data-stack-mirror-directory'] || '';
		newHeaders['data-stack-operating-system'] = req['local']['data-stack-operating-system'] || '';
		newHeaders['data-stack-deployment-name'] = req['local']['data-stack-deployment-name'] || '';
		newHeaders['data-stack-file-md5'] = req['local']['data-stack-file-md5'] || '';
		newHeaders['data-stack-file-ext'] = req['local']['data-stack-file-ext'] || '';
		newHeaders['data-stack-file-name'] = req['local']['data-stack-file-name'] || '';
		newHeaders['data-stack-file-size'] = req['local']['data-stack-file-size'] || '';
		newHeaders['data-stack-nano-service'] = req['local']['data-stack-nano-service'] || '';
		newHeaders['data-stack-flow'] = req['local']['data-stack-flow'] || '';

		req['local']['headers'] = newHeaders;

		try {
			${node.meta.sourceFormat.formatType != 'BINARY' ?
			`	if (Array.isArray(req.body)) {
            let rightArray = [];
            req.body.forEach(obj => {
              const leftData = obj;
              const rightData = {};
              ${mappings.join('\n\t\t\t\t')}
              rightArray.push(rightData);
            });
            req.body = rightArray;

            logger.trace('Transformed Headers - ', JSON.stringify(newHeaders));
            logger.trace('Transformed Out Data - ', JSON.stringify(req.body));

          } else {
            const leftData = req.body;
            const rightData = {};
            ${mappings.join('\n\t\t\t')}
            req.body = rightData;

            logger.trace('Transformed Headers - ', JSON.stringify(newHeaders));
            logger.trace('Transformed Out Data - ', JSON.stringify(req.body));
          }
        `
			:
			''
		}
      logger.info(\`Successfully completed Transformation Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);
      next();

		} catch (err) {
      ${getErrorBlock(node, 'Transform', 502)}
		}
	`;
}


function getMappingKeys(xslt, jsonTemplate = {}) {
	Object.keys(xslt).forEach(key => {
		if (key != '$headers') {
			const obj = xslt[key];
			let path = obj.properties.dataPath.split('.').filter(any => { if (any != 'definition') return any; }).join('.');
			if (path.split('_self.').length > 1) {
				path = path.split('_self.')[1];
			}
			if (obj.type == 'Object') {
				getMappingKeys(obj.definition, jsonTemplate);
			} else if (obj.type == 'Array') {
				if (obj.definition._self.type === 'Object') {
					jsonTemplate[path] = getArrayObjectMapping(obj, key);
				} else {
					const dataPath = obj.definition._self.properties._args[0].dataPath;
					const segments = dataPath.split('.');
					if (segments.indexOf('_data') > -1) {
						segments.shift();
					}
					segments.shift();
					let leftKey = segments.join('.');
					leftKey = leftKey.replace('[]', '');
					jsonTemplate[path] = `_.get(leftData, '${leftKey}') || null`;
				}
			} else {
				if (obj.properties._args) {
					if (obj.properties.operation && obj.properties.operation !== '') {
						jsonTemplate[path] = getFunctionMapping(obj.properties);
					} else {
						const dataPath = obj.properties._args[0].dataPath;
						const segments = dataPath.split('.');
						if (segments.indexOf('_data') > -1) {
							segments.shift();
						}
						segments.shift();
						const leftKey = segments.join('.');
						jsonTemplate[path] = `_.get(leftData, '${leftKey}') || null`;
					}
				}
			}
		}
	});
	return jsonTemplate;
}

function getFunctionMapping(obj, template = []) {

	let op = obj.operation ? obj.operation.split(':')[1] || obj.operation : '';
	op = op.trim();

	// if (stringOps.find(any => { return any === op})) {
	// 	if ( !obj._args.find(any => { return (any.innerType === 'String') }) ) {
	// 		throw {
	// 			message: 'A String function applied to a non string list of arguments'
	// 		};
	// 	}
	// } else if (numOps.find(any => { return any === op})) {
	// 	if ( obj._args.find(any => { return (any.innerType !== 'Number') }) ) {
	// 		throw {
	// 			message: 'A Number function applied to a non number list of arguments'
	// 		};
	// 	}
	// } else if (arrOps.find(any => { return any === op})) {
	// 	if ( !obj._args.find(any => { return (any.innerType === 'Array') }) ) {
	// 		throw {
	// 			message: 'An array function applied to a non array arguments'
	// 		};
	// 	}
	// }

	obj._args.forEach(arg => {
		if (arg.type === 'FIXED') {
			const dataPath = arg.dataPath;
			const segments = dataPath.split('.');
			if (segments.indexOf('_data') > -1) {
				segments.shift();
			}
			segments.shift();
			const leftKey = segments.join('.').replace('[]', '');

			if (arg.innerType === 'Array') {
				template.push(`(_.get(leftData, '${leftKey}') || [])`);
			} else {
				template.push(`(_.get(leftData, '${leftKey}') || '')`);
			}

		} else if (arg.type === 'DEDUCED') {
			template.push(getFunctionMapping(arg));

		} else if (arg.type === 'String') {
			if (arg.innerType === 'Array') {
				template.push(`('${arg.value || []}')`);
			} else {
				template.push(`('${arg.value || ''}')`);
			}
		} else if (arg.type === 'Number') {
			if (arg.innerType === 'Array') {
				template.push(`('${arg.value || []}')`);
			} else {
				template.push(`('${arg.value || 0}')`);
			}
		}
	});

	if (op === 'concat') {
		return `(${template.join('+')} || null)`;
	} else if (op === 'substring') {
		return `(${template[0]}.substring(${template[1]}, ${template[2]}) || null)`;
	} else if (op === 'upper-case') {
		return `(${template[0]}.toUpperCase() || null)`;
	} else if (op === 'lower-case') {
		return `(${template[0]}.toLowerCase() || null)`;
	} else if (op === 'replace') {
		return `(${template[0]}.replace(/${template[1]}/g, ${template[2]}) || null)`;
	} else if (op === 'contains') {
		return `(${template[0]}.includes(${template[1]}) || null)`;

	} else if (op === '+') {
		return template.join('+');
	} else if (op === '-') {
		return template.join('-');
	} else if (op === '*') {
		return template.join('*');
	} else if (op === 'ceiling') {
		return `Math.ceil(${template[0]})`;
	} else if (op === 'floor') {
		return `Math.floor(${template[0]})`;
	} else if (op === 'round-half-to-even') {
		return `Math.round(${template[0]})`;
	} else if (op === 'div') {
		return `(${template[0]} / ${template[1]})`;
	} else if (op === 'mod') {
		return `(${template[0]} % ${template[1]})`;

	} else if (op === 'max') {
		return `Math.max(...${template[0]})`;
	} else if (op === 'min') {
		return `Math.min(...${template[0]})`;
	} else if (op === 'avg') {
		return `((${template[0]}.reduce((a, b) => { return a + b }, 0) / ${template[0]}.length) || 0)`;
	} else if (op === 'sum') {
		return `(${template[0]}.reduce((a, b) => { return a + b }, 0) || 0)`;

	} else if (op === 'parse') {
		return `(moment(${template[0]}, ${template[1]}) || null)`;
	} else if (op === 'format') {
		if (template[0].includes('moment'))
			return `(${template[0]}.format(${template[1]}) || null)`;
		else
			return `(moment(${template[0]}, 'YYYY-MM-DDThh:mm:ss.Z').format(${template[1]}))`;
	} else {
		return template;
	}
}


function getArrayObjectMapping(def, key) {
	let path = def.properties.path.split('.').filter(any => { if (any != 'definition') return any; }).join('.');
	const code = [];
	const dataPath = def.properties.dataPath;
	if (dataPath) {
		const segments = dataPath.split('.');
		segments.shift();
		segments.shift();
		const leftKey = segments.join('.').replace('[]', '');
		code.push(`let ${key} = (_.get(leftData, '${leftKey}') || []);`);
		code.push(`${key} = ${key}.map(function(leftData) {`);
		code.push(`\tconst temp = {};`);
		const tempMapping = getMappingKeys(def.definition._self.definition);
		Object.keys(tempMapping).forEach(key => {
			if (typeof tempMapping[key] === 'string') {
				code.push(`\t_.set(temp, '${key}', ${tempMapping[key]});`);
			} else if (tempMapping[key] && tempMapping[key].code) {
				code.push(tempMapping[key].code);
				code.push(`\t_.set(temp, '${key}', ${key});`);
			}
		});
		code.push(`\treturn temp;`);
		code.push(`});`);
		code.push(`_.set(rightData, '${path}', ${key});`);
	}
	return {
		code: code.join('\n\t\t\t\t')
	}
}

function getHeaderMappingKeys(xslt, jsonTemplate = {}) {
	if (xslt['$headers'] && xslt['$headers'].definition) {
		xslt = xslt['$headers'].definition;
		Object.keys(xslt).forEach(key => {
			const obj = xslt[key];
			if (obj.properties._args && obj.properties._args.length > 0) {
				const dataPath = obj.properties._args[0].dataPath;
				const segments = dataPath.split('.');
				segments.shift();
				segments.shift();
				segments.shift();
				const leftKey = segments.join('.');
				jsonTemplate[obj.properties.dataKey.toLowerCase()] = leftKey.toLowerCase();
			}
		});
	}
	return jsonTemplate;
}


async function getRequestContent(flowData) {

	const { middlewares } = parseFlowJSON(flowData);

	const node = flowData.blocks[0];
	let nodeType = (node.meta.blockType === 'PROCESS') ? node.meta.processType : node.meta.blockType;
	let nodeName = node.meta.name || `Node ${node.meta.sequenceNo}`;
	let content = `
		const fs = require('fs');
		const path = require('path');
		const router = require('express').Router();
		const _ = require('lodash');
		const fastcsv = require('fast-csv');
		const XLSX = require('xlsx');
		const xlsxPopulate = require('xlsx-populate');
		const { parse } = require('fast-xml-parser');
		const J2XParser = require('fast-xml-parser').j2xParser;
		const request = require('request');
		const log4js = require('log4js');
		const moment = require('moment');

    const { getErrorResponse, getSchemaErrors, postRequest } = require('../utils/flow.utils.js');
		const { upsertInteraction, upsertInteractionBlock } = require('../utils/db.utils.js');
		const fileUtils = require('../utils/file.utils.js')

		if (process.env.NODE_ENV != 'production') {
			require('dotenv').config();
		}

		const config = require('../config');
		const flowData = require('../flow.json');

		let logger = global.logger;

		router.use(customLogger);

  	router.use(async (req, res, next) => {

   	  logger.info(\`Starting to Process Flow -> FlowDirection - \${config.dataStackFlowDirection} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')} \`);

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
			req['local']['headers'] = [];

			// Deny new requests, if process kill request was recieved
			if (global.stopServer) {
				let interactionBlock = {
					timestamp: new Date(),
					createTimestamp: new Date(),
					completedTimestamp: new Date(),
					inputStructureID: '${node.meta.sourceFormat.id || ''}',
					outputStructureID: '${node.meta.targetFormat.id || ''}',
					type: '${nodeType}',
					flowType: 'request',
					statusCode: 400,
					error: 'Server has stopped accepting requests'
				};

				logger.trace('Interaction Block Data -> NodeName - ${nodeName} | NodeType - ${nodeType} - ', interactionBlock);

				global.dbPromises.push(upsertInteractionBlock(req, interactionBlock));
				return res.status(400).json({ message: 'Server has stopped accepting requests' });
			}

			if (Buffer.isBuffer(req.body)) {
				req.body = req.body.toString();
			}
			next();
		});

		${middlewares.map(e => `router.use(async (req, res, next) => {${e}});`).join('\n\n')}

		function customLogger(req, res, next) {
			if (req.header('data-stack-txn-id')) {
				logger = log4js.getLogger(\`\${global.loggerName} [\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}]\`);
				// const trace = logger.trace;
				// const debug = logger.debug;
				// const info = logger.info;
				// const warn = logger.warn;
				// const error = logger.error;
				// logger.trace = function (data) {
				// 	trace.call(this, \`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}]\`, ...arguments);
				// }
				// logger.debug = function (data) {
				// 	debug.call(this, \`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}]\`, ...arguments);
				// }
				// logger.info = function (data) {
				// 	info.call(this, \`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}]\`, ...arguments);
				// }
				// logger.warn = function (data) {
				// 	warn.call(this, \`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}]\`, ...arguments);
				// }
				// logger.error = function (data) {
				// 	error.call(this, \`[\${req.header('data-stack-txn-id')}] [\${req.header('data-stack-remote-txn-id')}]\`, ...arguments);
				// }
			}
			next();
		};

		module.exports = router;
	`;
	return { content };
}


function getErrorBlock(node, type, statusCode) {

	let nodeType = (node.meta.blockType === 'PROCESS') ? node.meta.processType : node.meta.blockType;
	let nodeName = node.meta.name || `Node ${node.meta.sequenceNo}`;

	return `
		logger.info(\`Error in Node -> NodeName - ${nodeName} | NodeType - ${nodeType} | FlowType - ${node.meta.flowType} | Data-Stack-Txn-Id - \${req.header('data-stack-txn-id')} | Data-Stack-Remote-Txn-Id - \${req.header('data-stack-remote-txn-id')}\`);
		logger.error(err);

		if (JSON.stringify(err).includes('Validation Failed')) {
			let errs = JSON.parse(JSON.stringify(err));
			err = {};
			errs.map((e,i) => {
				if (e['error']) {
					err[i] = e;
				}
			});
		}

		${node.meta.flowType === 'request' ?
			`	let interaction = {
          			dataStackTxnId: req['local']['data-stack-txn-id'],
					remoteTxnId: req['local']['data-stack-remote-txn-id'],
					flowId: config.dataStackFlowId,
					partnerId: config.dataStackPartnerId,
					appName: config.dataStackAppName,
					direction: config.dataStackFlowDirection,
					timestamp: timestamp,
					completedTimestamp: new Date(),
					status: 'ERROR'
				};

				logger.trace('Interaction Data - NodeName - ${nodeName} | NodeType - ${nodeType} - ', interaction);

				global.dbPromises.push(upsertInteraction(req, interaction));
			`
			:
			``
		}

    let interactionBlock = {
      timestamp: timestamp,
      createTimestamp: timestamp,
      completedTimestamp: new Date(),
      inputStructureID: '${node.meta.sourceFormat.id || ''}',
      outputStructureID: '${node.meta.targetFormat.id || ''}',
      type: '${type}',
      ${type === 'API' ? `endpoint: '/api/post',` : ``}
			${type === 'nanoService' || type === 'dataService' ?
			`	serviceID: '${node.meta.formatId || ''}',
					serviceName: '${node.meta.formatName || ''}',
					url: '${node.meta.connectionDetails.url || ''}',
					connectionType: '${node.meta.connectionDetails.connectionType || ''}',
					two_way_ssl: '${node.meta.connectionDetails.two_way_ssl || ''}',
      	`
			:
			``
		}
			statusCode: err.statusCode || ${statusCode},
      error: err.message || JSON.stringify(err)
    };

    logger.trace('Interaction Block Data -> NodeName - ${nodeName} | NodeType - ${nodeType} - ', interactionBlock);

    global.dbPromises.push(upsertInteractionBlock(req, interactionBlock));

    const details = {
			nodeName: '${nodeName}',
      flowType: '${node.meta.flowType}',
      nodeType: '${nodeType}',
      nodeId: req['local']['nodeId']
    };

    let errorData = getErrorResponse(details, err, err.statusCode || ${statusCode});

    logger.info('Triggring Error Flow from ${nodeName}');

		${node.meta.flowType === 'error' ?
			`res.status(errorData.statusCode).json(errorData.body);`
			:
			`	let options = {
					url: config.errorFlowUrl,
					body: errorData,
					headers: {
						'data-stack-txn-id': req['local']['data-stack-txn-id'],
						'data-stack-remote-txn-id': req['local']['data-stack-remote-txn-id']
					}
				};

				return postRequest(options)
					.then((response) => res.status(${statusCode}).json(JSON.stringify(err)))
					.catch((err) => res.status(err.statusCode || ${statusCode}).json(err.message || err));
			`
		}
  `;
}


module.exports = {
	getSchemaValidationMiddleware,
	getTransformMiddleware,
	getProcessRequestMiddleware,
	getAuthMiddleware,
	getErrorBlock,
	getRequestContent
};
