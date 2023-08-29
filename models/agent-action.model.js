const mongoose = require('mongoose');

const config = require('../config');
const definition = require('../schemas/agent-action.schema').definition;
const mongooseUtils = require('../utils/mongoose.utils');

const expiry = config.B2B_TRANSFER_LEDGER_ENTRY_TTL;
const schema = mongooseUtils.MakeSchema(definition);

schema.plugin(mongooseUtils.metadataPlugin());
schema.pre('save', mongooseUtils.generateId('ACTION', 'b2b.agent.actions', null, 4, 1000));
schema.index({ timestamp: 1 }, { expireAfterSeconds: expiry });

mongoose.model('agent-action', schema, 'b2b.agent.actions');