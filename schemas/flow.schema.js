
var definition = {
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
	'partner': {
		'type': 'String',
		'required': true
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
	'flowStatus': {					//Internal
		'type': 'String',
		'enum': ['Pending', 'Stopped', 'Error', 'Active'],
		'default': 'Pending'
	},
	'comment': {                         //Internal
		'type': 'String'
	},
	'structures': [{
		'id': 'String',
		'customId': 'String',
		'type': { 'type': 'String' }, // enum 'dataFormat', 'dataService', 'custom', 'binary'
		'definition': { 'type': 'Object' },
		'meta': { 'type': 'Object' }
	}],
	'blocks': { 'type': 'Object' },
	'successBlocks': { 'type': 'Object' },
	'errorBlocks': { 'type': 'Object' },
	'inputType': {
		'type': 'String',
		'enum': ['API', 'FILE']
	},
	'outputType': {
		'type': 'String',
		'enum': ['API', 'FILE']
	},
	'timer': {
		'type': 'Object'
	},
	'port': { 'type': 'String' },
	'dataService': [{ 'type': 'String' }],
	'dataFormat': [{ 'type': 'String' }],
	'nanoService': [{ 'type': 'String' }],
	'edgeGatewayFQDN': { 'type': 'String' },
	'gatewayFQDN': { 'type': 'String' },
	'description': { 'type': 'String' },
	'changedDependencies': [{
		'id': { 'type': 'String' },
		'entity': {
			'type': 'String',
			'enum': ['nanoService', 'dataService', 'dataFormat']
		},
	}],
	'_metadata': {
		'type': {
			'version': {
				'release': { 'type': 'Number' }
			},
			'lastUpdatedBy': { 'type': 'String' }
		}
	},
	'isBinary': {
		'type': 'Boolean'
	}
};

module.exports.definition = definition;