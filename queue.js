const NATS = require('node-nats-streaming');
const log4js = require('log4js');
const config = require('./config');
const mongoose = require('mongoose');
const faasModel = mongoose.model('faas');

log4js.configure({
	appenders: { out: { type: 'stdout' } },
	categories: { default: { appenders: ['out'], level: process.env.LOG_LEVEL || 'info' } }
});

const logger = log4js.getLogger(global.loggerName);
const clusterName = process.env.STREAMING_CHANNEL || 'datastack-cluster';
const clientId = `${process.env.HOSTNAME || 'B2B-MANAGER'}` + Math.floor(Math.random() * 10000);
const streamingConfig = config.streamingConfig;

let client;

function init() {
	if (!client) {
		logger.debug(`clusterName: ${clusterName}, clientId: ${clientId}, streamingConfig: ${JSON.stringify(streamingConfig)}`);
		client = NATS.connect(clusterName, clientId, streamingConfig);
		client.on('error', function (err) {
			logger.error(err);
		});

		client.on('connect', function () {
			logger.info('Connected to streaming server');
			faasInvokeLogger();
		});

		client.on('disconnect', function () {
			logger.info('Disconnected from streaming server');
		});

		client.on('reconnecting', function () {
			logger.info('Reconnecting to streaming server');
			faasInvokeLogger();
		});

		client.on('reconnect', function () {
			logger.info('Reconnected to streaming server');
		});

		client.on('close', function () {
			logger.info('Connection closed to streaming server');
		});
	}
	return client;
}


function faasInvokeLogger() {
	var opts = client.subscriptionOptions();
	opts.setStartWithLastReceived();
	opts.setDurableName('faas-durable');
	var subscription = client.subscribe(config.faasLastInvokedQueue, 'faas', opts);
	subscription.on('message', function (_body) {
		let bodyObj = JSON.parse(_body.getData());
		logger.trace(`Message from queue :: ${config.faasLastInvokedQueue} :: ${JSON.stringify(bodyObj)}`);
		const payload = bodyObj.data;
		try {
			await faasModel.findOneAndUpdate({ "_id": payload._id }, { $set: { "lastInvokedAt": payload.startTime }});
		} catch (err) {
			logger.error('Error updating function lastInvokedTime :: ', err);
		}
		
		
		
		// let colName = bodyObj.collectionName;
		// let colName = 'b2b.faas.logs';
		
		// let mongoDBColl = mongoose.connection.db.collection(colName);
		// if (colName && payload) {
		// 	payload.colName = bodyObj.collectionName;
		// 	fixAPILogPayload(payload);
		// 	fixMetaData(payload);
		// 	let promise = Promise.resolve();
		// 	if (!payload.serviceId) {
		// 		promise = serviceUtils.getServiceId(bodyObj.collectionName);
		// 	}
		// 	promise.then(data => {
		// 		if (data && data._id) {
		// 			payload.serviceId = data._id;
		// 		}
		// 		return mongoDBColl.insert(payload)
		// 			.catch(err => {
		// 				logger.error(err);
		// 			});
		// 	}).catch(err => {
		// 		logger.error(err);
		// 	});
		// }
	});
}


/**
 * 
 * @param {*} data The Object that needs to be pushed into the queue
 */
function sendToQueue(data) {
	client.publish(config.queueName, JSON.stringify(data));
}

module.exports = {
	init: init,
	sendToQueue: sendToQueue,
	getClient: function () {
		return client;
	}
};
