const mongoose = require('mongoose');

const config = require('../config');
const definition = require('../schemas/agent-logs.schema').definition;
const mongooseUtils = require('../utils/mongoose.utils');

const expiry = config.B2B_AGENT_LOGS_TTL_DAYS * 86400;
const schema = mongooseUtils.MakeSchema(definition);
schema.plugin(mongooseUtils.metadataPlugin());
schema.pre('save', function(next) {
    next();
});
schema.index({ app: 1, agentId: 1 });
schema.index({ timestamp: 1 }, { expireAfterSeconds: expiry });

mongoose.model('agent-logs', schema, 'b2b.agent.logs');