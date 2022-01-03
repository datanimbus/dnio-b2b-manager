let expiry = require('../config').agentMonitoringExpiry;
var definition = {
	'agentID': {
		'type': 'String'
	},
	'responseAgentID': {
		'type': 'String'
	},
	'heartBeatFrequency': {
		'type': 'String'
	},
	'status': {
		'type': 'String'
	},
	'ipAddress': {
		'type': 'String'
	},
	'macAddress': {
		'type': 'String'
	},
	'appName': {
		'type': 'String'
	},
	'partnerName': {
		'type': 'String'
	},
	'timestamp': {
		'type': 'Date',
		'default': Date.now,
		'expires': expiry
	},
	'agentType': {
		'type': 'String'
	},
	'agentName': {
		'type': 'String'
	},
	'pendingFiles': {
		'type': 'Object'
	},
	'release': {
		'type': 'String'
	},
	'_metadata': {
		'type': {
			'version': {
				'release': { 'type': 'Number' }
			}
		}
	}
};

module.exports.definition = definition;