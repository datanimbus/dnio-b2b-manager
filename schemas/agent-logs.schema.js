const definition = {
	'agentId': {
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
	'app': {
		'type': 'String'
	},
	'timestamp': {
		'type': 'Date',
		'default': Date.now
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