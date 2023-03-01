const definition = {
	'_id': {
		'type': 'String',
		'default': null
	},
	'app': {
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
	'draftVersion': {
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
	'namespace': {					 //Internal
		'type': 'String'
	},
	'skipAuth': {
		'type': 'Boolean',
		'default': false
	},
	'status': {                          //Internal
		'type': 'String',
		'enum': ['Pending', 'Stopped', 'Error', 'Active', 'Draft'],
		'default': 'Draft'
	},
	'lastInvoked': {
		'type': 'Date'
	},
	'inputNode': { 'type': 'Object' },
	'nodes': { 'type': 'Object' },
	'errorNode': { 'type': 'Object' },
	'dataStructures': { 'type': 'Object' },
	'port': { 'type': 'String' },
	'description': { 'type': 'String' },
	'isBinary': {
		'type': 'Boolean',
		'default': false
	}
};

module.exports.definition = definition;