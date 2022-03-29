const definition = {
	'_id': {
		'type': 'String'
	},
	'name': {
		'type': 'String',
		'required': true
	},
	'description': { 'type': 'String' },
	'definition': {
		'type': 'Object',
	},
	'app': {
		'type': 'String',
		'required': true
	},
	'formatType': {
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