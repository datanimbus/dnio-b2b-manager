const NATS = require('node-nats-streaming');
const config = require('./config');
const mongoose = require('mongoose');

const logger = global.logger;
const clusterName = process.env.STREAMING_CHANNEL || 'datastack-cluster';
const clientId = `${process.env.HOSTNAME || 'B2B-MANAGER'}` + Math.floor(Math.random() * 10000);
const streamingConfig = config.streamingConfig;

let client;

function init() {
	if (!client) {
		logger.trace(`clusterName: ${clusterName}, clientId: ${clientId}, streamingConfig: ${JSON.stringify(streamingConfig)}`);
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
	subscription.on('message', async function (_body) {
		const faasModel = mongoose.model('faas');
		let bodyObj = JSON.parse(_body.getData());
		logger.trace(`Message from queue :: ${config.faasLastInvokedQueue} :: ${JSON.stringify(bodyObj)}`);
		try {
			const timestamp = new Date(bodyObj.startTime);
			await faasModel.findOneAndUpdate({ _id: bodyObj._id }, { $set: { lastInvoked: timestamp } });
		} catch (err) {
			logger.error('Error updating function lastInvokedTime :: ', err);
		}
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
