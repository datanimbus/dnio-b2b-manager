const definition = {
	'_id': {
		'type': 'String'
	},
	'tokenID': {
		'type': 'String'
	},
	'agentId': {
		'type': 'String'
	},
	'creationTimestamp': {
		'type': 'Date'
	},
	'lastAllocationTimestamp': {
		'type': 'Date'
	},
	'lastReleaseTimestamp': {
		'type': 'Date'
	},
	'remoteTxnID': {					 
		'type': 'String'
	},
	'dataStackTxnID': {					
		'type': 'String'
	},
	'tokenInUse': {					 
		'type': 'Boolean'
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