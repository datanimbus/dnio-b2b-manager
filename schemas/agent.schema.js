const definition = {
    '_id': {
        'type': 'String'
    },
    'app': {
        'type': 'String'
    },
    'partner': {
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
        'type': 'Object'
    },
    'name': {
        'type': 'String'
    },
    'password': {
        'type': 'String'
    },
    'absolutePath': {
        'type': 'String'
    },
    'lastInvokedAt': {
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
    '_metadata': {
        'type': {
            'version': {
                'release': { 'type': 'Number' }
            }
        }
    },
    'internal': {
        'type': 'Boolean',
        'default': false
    },
    'vaultVersion': {
        'type': 'Number',
        'default': 1
    }
};

module.exports.definition = definition;