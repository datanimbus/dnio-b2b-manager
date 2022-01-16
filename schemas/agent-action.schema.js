const definition = {
    '_id': {
        'type': 'String'
    },
    'agentId': {
        'type': 'String'
    },
    'namespace': {
        'type': 'String'
    },
    'deploymentName': {
        'type': 'String'
    },
    'app': {
        'type': 'String'
    },
    'partnerId': {
        'type': 'String'
    },
    'partnerName': {
        'type': 'String'
    },
    'action': {
        'type': 'String'
    },
    'metaData': {
        'type': 'String'
    },
    'sentOrRead': {
        'type': 'Boolean'
    },
    'entryType': {
        'type': 'String'
    },
    'timestamp': {
        'type': 'Date',
        'default': Date.now
    },
    'status': {
        'type': 'String',
        'default': 'Pending'
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