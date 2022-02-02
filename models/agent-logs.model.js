// const log4js = require('log4js');
const mongoose = require('mongoose');
// const _ = require('lodash');

// const config = require('../config');
const definition = require('../schemas/agent-logs.schema').definition;
const mongooseUtils = require('../utils/mongoose.utils');

// const logger = log4js.getLogger(global.loggerName);


const schema = new mongoose.Schema(definition, {
	usePushEach: true
});

schema.plugin(mongooseUtils.metadataPlugin());

mongoose.model('agent.logs', schema, 'b2b.agent.logs');