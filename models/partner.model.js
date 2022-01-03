const mongoose = require('mongoose');
const _ = require('lodash');

const config = require('../../config');
const definition = require('../schemas/partner.schema').definition;
const mongooseUtils = require('../utils/mongoose.utils');

const logger = global.logger;
let model;


const schema = new mongoose.Schema(definition, {
    usePushEach: true
});

schema.plugin(mongooseUtils.metadataPlugin());

model = mongoose.model('partner', schema, 'b2b.partners');