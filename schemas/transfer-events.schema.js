const envConfig = require('../config');
const expiry = envConfig.hbFrequency * envConfig.hbMissCount;

var definition = {
    '_id': {
        'type': 'String'
    },
    'agentID': {
        'type': 'String'
    },
    'namespace': {
        'type': 'String'
    },
    'deploymentName': {
        'type': 'String'
    },
    'appName': {
        'type': 'String'
    },
    'partnerID': {
        'type': 'String'
    },
    'flowID': {
        'type': 'String'
    },
    'partnerName': {
        'type': 'String'
    },
    'flowName': {
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
        'default': Date.now,
        'expires': expiry
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