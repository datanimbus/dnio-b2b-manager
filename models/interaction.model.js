// const log4js = require('log4js');
const mongoose = require('mongoose');
// const _ = require('lodash');

// const config = require('../config');
const definition = require('../schemas/interaction.schema').definition;
const mongooseUtils = require('../utils/mongoose.utils');

// const logger = log4js.getLogger(global.loggerName);



const schema = mongooseUtils.MakeSchema(definition);

schema.index({ flowId: 1, app: 1 });
schema.index({ parentInteraction: 1 });

schema.plugin(mongooseUtils.metadataPlugin());
schema.pre('save', mongooseUtils.generateId('INTR', 'interations', null, 4, 1000));

mongoose.model('interaction', schema, 'b2b.interactions');