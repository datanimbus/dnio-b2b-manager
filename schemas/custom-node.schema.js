const definition = {
	'_id': {
		'type': 'String'
	},
	'name': {
		'type': 'String'
	},
	'app': {
		'type': 'String'
	},
	'version': {
		'type': 'Number',
		'default': 1
	},
	'icon': {
		'type': 'String'
	},
	'color': {
		'type': 'String'
	},
	'type': {
		'type': 'String'
	},
	'category': {
		'type': 'String'
	},
	'code': {
		'type': 'String'
	},
	'fields': [
		{
			'dataType': {
				'type': 'String'
			},
			'htmlType': {
				'type': 'String'
			},
			'label': {
				'type': 'String'
			},
			'key': {
				'type': 'String'
			}
		}
	]
};

module.exports.definition = definition;