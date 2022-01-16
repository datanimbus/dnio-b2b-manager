const definition = {
	'_id': {
		'type': 'String',
		'default': null
	},
	'app': { 'type': 'String', 'required': true },
	'name': {
		'type': 'String',
		'required': true
	},
	'description': {
		'type': 'String'
	},
	'logo': {
		'type': 'String'
	},
	'secrets': [{
		'name': { 'type': 'String' },
		'type': {
			'type': 'String',
			'enum': ['credentials', 'apiKey', 'certificate'],
		},
		'secretId': {
			'type': 'string'
		},
		'meta': { 'type': 'Object' }
	}],
	'flows': [{ 'type': 'String' }],
	'agentId': { 'type': 'String' },
	'headers': {
		'type': 'Object'
	},
	'agentTrustedIP': {
		'list': [{
			'type': 'String'
		}],
		'enabled': {
			'type': 'Boolean',
			'default': false
		}
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