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
		'type': 'String',
		'required': true
	},
	'description': {
		'type': 'String'
	},
	'collectionName': {
		'type': 'String'
	},
	'deploymentName': {					 //Internal
		'type': 'String'
	},
	'namespace': {						//Internal
		'type': 'String'
	},
	'url': {
		'type': 'String',
		'required': true
	},
	'port': {
		'type': 'Number',
		'required': false
	},
	'code': {
		'type': 'String'
	},
	'headers': {
		'type': 'Object'
	},
	'version': {
		'type': 'Number',
		'default': 1
	},
	'status': {
		'type': 'String',
		'enum': ['Pending', 'Active', 'Undeployed', 'Maintenance', 'Draft'],
		'default': 'Draft'
	},
	'draftVersion': {
		'type': 'Number'
	},
	'lastInvoked': {
		'type': 'Date'
	}
};

module.exports.definition = definition;