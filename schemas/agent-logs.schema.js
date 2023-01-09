const definition = {
	'agentId': {
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
	'ipAddress': {
		'type': 'String'
	},
	'macAddress': {
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
	},
	'logLevel': {
		'type': 'String'
	},
	'message': {
		'type': 'String'
	}
};

module.exports.definition = definition;