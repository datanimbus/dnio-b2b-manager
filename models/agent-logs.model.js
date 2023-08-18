const mongoose = require('mongoose');

// const config = require('../config');
const definition = require('../schemas/agent-logs.schema').definition;
const mongooseUtils = require('../utils/mongoose.utils');

const schema = mongooseUtils.MakeSchema(definition);
schema.plugin(mongooseUtils.metadataPlugin());
schema.index({ app: 1, agentId: 1 });

mongoose.model('agent-logs', schema, 'b2b.agent.logs');