const definition = {
    '_id': {
        'type': 'String'
    },
    'agentId': {
        'type': 'String'
    },
    'action': {
        'type': 'String'
    },
    'metaData': {
        'type': 'Object'
    },
    'sentOrRead': {
        'type': 'Boolean',
        'default': false
    },
    'timestamp': {
        'type': 'Date',
        'default': Date.now
    }
};

module.exports.definition = definition;