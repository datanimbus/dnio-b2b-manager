const definition = {
	'_id': {
		'type': 'String'
	},
	'name': {
		'type': 'String',
		'required': true
	},
	'description': { 'type': 'String' },
	'type': { 'type': 'String', 'default': 'Object' },
	'definition': {
		'type': [
			{
				'key': {
					'type': 'String',
					'required': false
				},
				'type': {
					'type': 'String',
					'required': true
				},
				'definition': {
					'type': 'Object',
					'required': false
				},
				'properties': {
					'type': 'Object'
				}
			}
		]
	},
	'app': {
		'type': 'String',
		'required': true
	},
	'formatType': {
		'type': 'String'
	},
	'subType': {
		'type': 'String'
	},
	'excelType': {
		'type': 'String'
	},
	'lineSeparator': {
		'type': 'String'
	},
	'strictValidation': {
		'type': 'Boolean'
	},
	'character': {
		'type': 'String'
	},
	'attributeCount': {
		'type': 'Number',
		'default': 0
	}
};
module.exports.definition = definition;