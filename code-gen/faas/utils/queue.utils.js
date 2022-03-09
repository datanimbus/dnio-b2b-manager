let config = require('../config');

var clientId = isK8sEnv() ? `${process.env.HOSTNAME}` : 'FAAS';
var client = require('@appveen/data.stack-utils').streaming.init(
	process.env.STREAMING_CHANNEL || 'datastack-cluster',
	clientId,
	config.NATSConfig
);

const logger = global.logger;

function isK8sEnv() {
	return process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT;
}
 
client.on('connect', function() {
	logger.info('STREAMING connected');
});
 
client.on('disconnect', function() {
	logger.info('STREAMING disconnect');
});
 
client.on('reconnecting', function() {
	logger.info('STREAMING reconnecting');
});
 
client.on('reconnect', function() {
	logger.info('STREAMING reconnect');
});
 
client.on('close', function() {
	logger.info('STREAMING close');
});

global.client = client;

module.exports = {
	client: client
};
