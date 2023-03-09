const definition = {
    '_id': {
        'type': 'String'
    },
    'app': {
        'type': 'String'
    },
    'agentId': {
        'type': 'String'
    },
    'release': {
        'type': 'String'
    },
    'status': {
        'type': 'String',
        'default': 'PENDING'
    },
    'type': {
        'type': 'String',
        'enum': ['PARTNERAGENT', 'IG', 'APPAGENT']
    },
    'macAddress': {
        'type': 'String'
    },
    'ipAddress': {
        'type': 'String'
    },
    'pendingFiles': {
        'type': 'Number',
        'default': 0
    },
    'name': {
        'type': 'String'
    },
    'password': {
        'type': 'String'
    },
    'secret': {
        'type': 'String'
    },
    'absolutePath': {
        'type': 'String'
    },
    'lastInvokedAt': {
        'type': 'Date'
    },
    'lastLoggedIn': {
        'type': 'Date'
    },
    'encryptFile': {
        'type': 'Boolean',
        'default': false
    },
    'retainFileOnSuccess': {
        'type': 'Boolean'
    },
    'retainFileOnError': {
        'type': 'Boolean'
    },
    'scheduleBasedFileTransfer': {
        'type': 'Boolean'
    },
    'schedule': {
        'type': 'String'
    },
    'internal': {
        'type': 'Boolean',
        'default': false
    },
    'active': {
        'type': 'Boolean',
        'default': true
    }
};

module.exports.definition = definition;