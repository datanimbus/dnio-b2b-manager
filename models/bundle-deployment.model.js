// const log4js = require('log4js');
const mongoose = require('mongoose');
const dataStackUtils = require('@appveen/data.stack-utils');
// const utils = require('@appveen/utils');
const _ = require('lodash');

const config = require('../config');
const queue = require('../queue');
const definition = require('../schemas/bundle-deployment.schema').definition;
const mongooseUtils = require('../utils/mongoose.utils.js');
// const commonUtils = require('../utils/common.utils');

// const logger = log4js.getLogger(global.loggerName);

const client = queue.getClient();
dataStackUtils.eventsUtil.setNatsClient(client);


const schema = mongooseUtils.MakeSchema(definition);

schema.plugin(mongooseUtils.metadataPlugin());

schema.index({ name: 1, app: 1 }, { unique: true, sparse: true, collation: { locale: 'en_US', strength: 2 } });

schema.pre('save', function (next) {
	this._isNew = this.isNew;
	if (!this.app) {
		return next(new Error('App Value is Mandatory'));
	}
	if (!this.deploymentName) {
		this.deploymentName = 'b2b-bundle-' + _.camelCase(this.name).toLowerCase();
	}
	if (!this.namespace) {
		this.namespace = (config.DATA_STACK_NAMESPACE + '-' + this.app).toLowerCase();
	}
	next();
});

// schema.pre('save', async function (next) {
// 	try {
// 		let flowModel = mongoose.model('flow');
// 		let flows = await flowModel.find({ _id: { $in: this.bundle } }).select({}).lean();
// 		this.bundle = flows.map(e => e._id);
// 		let promises = flows.map(async (item) => {
// 			try {

// 			} catch (err) {

// 			}
// 		});
// 		await Promise.all(promises);
// 		next();
// 	} catch (err) {
// 		next(err);
// 	}
// });

schema.pre('save', mongooseUtils.generateId('DEP', 'services.bundle', null, 4, 2000));

schema.post('save', function (error, doc, next) {
	if ((error.errors && error.errors.name) || error.name === 'ValidationError' || error.message.indexOf('E11000') > -1
		|| error.message.indexOf('__CUSTOM_NAME_DUPLICATE_ERROR__') > -1) {
		next(new Error('Bundle name is already in use'));
	} else {
		next(error);
	}
});

mongoose.model('bundle-deployment', schema, 'services.bundle');