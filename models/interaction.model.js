const log4js = require('log4js');
const mongoose = require('mongoose');
const _ = require('lodash');

const config = require('../config');
const definition = require('../schemas/interaction.schema').definition;
const mongooseUtils = require('../utils/mongoose.utils');

const logger = log4js.getLogger(global.loggerName);
let model;


const schema = new mongoose.Schema(definition, {
    usePushEach: true
});

schema.plugin(mongooseUtils.metadataPlugin());

model = mongoose.model('interaction', schema, 'b2b.interactions');