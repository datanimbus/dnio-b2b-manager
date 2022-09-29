const definition = {
	'_id': {
		'type': 'String',
		'default': null
	},
	'app': {
		'type': 'String',
		'required': true
	},
	'flowId': {
		'type': 'String',
		'required': true
	},
	'headers': {
		'type': 'Object',
	},
	'name': {
		'type': 'String'
	},
	'status': {                          //Internal
		'type': 'String',
		'enum': ['PENDING', 'ERROR', 'SUCCESS', 'UNKNOWN'],
		'default': 'PENDING'
	},
	'_metadata': {
		'type': {
			'version': {
				'type': {
					'release': { 'type': 'Number' }
				}
			},
			'lastUpdatedBy': { 'type': 'String' }
		}
	}
};

module.exports.definition = definition;