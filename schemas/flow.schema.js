const definition = {
	'_id': {
		'type': 'String',
		'default': null
	},
	'app': {
		'type': 'String',
		'required': true
	},
	'api': {
		'type': 'String',
		'required': true
	},
	'name': {
		'type': 'String'
	},
	'direction': {
		'type': 'String',
		'enum': ['Outbound', 'Inbound']
	},
	'version': {
		'type': 'Number',
		'default': 1
	},
	'runningVersion': {
		'type': 'Number'
	},
	'runningFlow': {					 //Internal
		'type': 'String'
	},
	'nextFlow': {					 //Internal
		'type': 'String'
	},
	'deploymentName': {					 //Internal
		'type': 'String'
	},
	'status': {                          //Internal
		'type': 'String',
		'enum': ['Pending', 'Stopped', 'Error', 'Active', 'Draft'],
		'default': 'Draft'
	},
	'stages': { 'type': 'Object' },
	'port': { 'type': 'String' },
	'description': { 'type': 'String' }
};

module.exports.definition = definition;