const NATS = require('node-nats-streaming');
const log4js = require('log4js');
const config = require('./config');

log4js.configure({
	appenders: { out: { type: 'stdout' } },
	categories: { default: { appenders: ['out'], level: process.env.LOG_LEVEL || 'info' } }
});

const logger = log4js.getLogger(global.loggerName);
const clusterName = process.env.STREAMING_CHANNEL || 'datastack-cluster';
const clientId = `${process.env.HOSTNAME || 'B2B-MANAGER'}` + Math.floor(Math.random() * 10000);
const streamingConfig = config.streamingConfig

let client;

function init() {
	if (!client) {
		logger.debug(`clusterName: ${clusterName}, clientId: ${clientId}, streamingConfig: ${JSON.stringify(streamingConfig)}`)
		client = NATS.connect(clusterName, clientId, streamingConfig);
		client.on('error', function (err) {
			logger.error(err);
		});

		client.on('connect', function () {
			logger.info('Connected to streaming server');
		});

		client.on('disconnect', function () {
			logger.info('Disconnected from streaming server');
		});

		client.on('reconnecting', function () {
			logger.info('Reconnecting to streaming server');
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


/**
 * 
 * @param {*} data The Object that needs to be pushed into the queue
 */
function sendToQueue(data) {
	client.publish(config.queueName, JSON.stringify(data));
}

module.exports = {
	init: init,
	sendToQueue: sendToQueue
};
