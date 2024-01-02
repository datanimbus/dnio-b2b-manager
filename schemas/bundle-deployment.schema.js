var defintion = {
	'_id': {
		'type': 'String'
	},
	'name': {
		'type': 'String',
		'required': true
	},
	'app': {
		'type': 'String',
		'required': true
	},
	'deploymentName': {
		'type': 'String',
		'required': true
	},
	'namespace': {
		'type': 'String'
	},
	'bundle': [
		{
			'type': 'String'
		}
	],
	'_metadata': {
		'type': {
			'version': {
				'release': {
					'type': 'Number'
				}
			}
		}
	}
};
module.exports.definition = defintion;