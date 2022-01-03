const mongoose = require('mongoose');
const _ = require('lodash');

const config = require('../../config');
const definition = require('../schemas/flow.schema').definition;
const mongooseUtils = require('../utils/mongoose.utils');

const logger = global.logger;
let model;


const schema = new mongoose.Schema(definition, {
    usePushEach: true
});

schema.plugin(mongooseUtils.metadataPlugin());

model = mongoose.model('flow', schema, 'b2b.flows');