const log4js = require('log4js');
const mongoose = require('mongoose');
const dataStackUtils = require('@appveen/data.stack-utils');
// const utils = require('@appveen/utils');
// const _ = require('lodash');

const config = require('../config');
const queue = require('../queue');
const definition = require('../schemas/data-format.schema').definition;
const mongooseUtils = require('../utils/mongoose.utils.js');
const commonUtils = require('../utils/common.utils');

const logger = log4js.getLogger(global.loggerName);

const client = queue.getClient();
dataStackUtils.eventsUtil.setNatsClient(client);


const schema = mongooseUtils.MakeSchema(definition);

schema.plugin(mongooseUtils.metadataPlugin());

schema.index({ name: 1, app: 1 }, { unique: true, sparse: true, collation: { locale: 'en_US', strength: 2 } });

schema.post('save', function (error, doc, next) {
	if ((error.errors && error.errors.name) || error.name === 'ValidationError' || error.message.indexOf('E11000') > -1
		|| error.message.indexOf('__CUSTOM_NAME_DUPLICATE_ERROR__') > -1) {
		next(new Error('Data Format name is already in use'));
	} else {
		next(error);
	}
});

// schema.pre('save', utils.counter.getIdGenerator('DF', 'b2b.dataFormats', null, null, 1000));
schema.pre('save', mongooseUtils.generateId('DF', 'b2b.dataFormats', null, 4, 2000));

schema.pre('save', dataStackUtils.auditTrail.getAuditPreSaveHook('dataFormat'));

schema.post('save', dataStackUtils.auditTrail.getAuditPostSaveHook('dataFormat.audit', client, 'auditQueue'));

schema.pre('remove', dataStackUtils.auditTrail.getAuditPreRemoveHook());

schema.post('remove', dataStackUtils.auditTrail.getAuditPostRemoveHook('dataFormat.audit', client, 'auditQueue'));

// schema.pre('save', async function (next, req) {
// 	try {
// 		this._req = req;
// 		const res = await commonUtils.getApp(req, this.app);
// 		if (res.statusCode !== 200) {
// 			return next(new Error('Invalid app ' + this.app));
// 		}
// 		return next();
// 	} catch (err) {
// 		return next(err);
// 	}
// });

// schema.pre('remove', async function (next, req) {
// 	try {
// 		this._req = req;
// 		const flows = await mongoose.model('b2b.flows').find({ dataFormat: this._id }).lean(true);
// 		if (flows.length > 0) {
// 			return next(new Error('Flows ' + flows.map(f => f.name) + ' still use this data format'));
// 		}
// 		return next();
// 	} catch (err) {
// 		return next(err);
// 	}
// });

schema.post('remove', function (doc) {
	let appDB = mongoose.connections[1].useDb(config.DATA_STACK_NAMESPACE + '-' + doc.app);
	appDB.dropCollection(`dataformat.${doc._id}`).catch((err) => {
		logger.error(`Error Orrcured while deleting collection - dataformat.${doc._id}`);
		logger.error(err);
	});
});

schema.pre('save', function (next) {
	this._isNew = this.isNew;
	if (!this.app) {
		return next(new Error('App Value is Mandatory'));
	}
	if (!this.definition) return next();
	let temp;
	if (typeof this.definition === 'string') {
		temp = JSON.parse(this.definition);
	} else {
		temp = this.definition;
	}
	if (temp && temp.length > 0) {
		this.attributeCount = commonUtils.countAttr(temp);
	}
	next();
});

//Update flow if DF changed
// schema.post('save', function (doc) {
//     if (doc._auditData) {
//         let oldData = doc._auditData.data.old;
//         let newData = doc.toJSON();
//         if (!_.isEqual(JSON.parse(JSON.stringify(oldData)), JSON.parse(JSON.stringify(newData))));
//         return flowHelper.updateFlowOnDependencyChange(doc._id, 'dataFormat', doc._req);
//     }
// });

schema.post('save', function (doc) {
	if (!doc._req) {
		doc._req = {};
	}
	if (doc._isNew) {
		dataStackUtils.eventsUtil.publishEvent('EVENT_DF_CREATE', 'dataFormat', doc._req, doc);
	} else {
		dataStackUtils.eventsUtil.publishEvent('EVENT_DF_UPDATE', 'dataFormat', doc._req, doc);
	}
});

schema.post('remove', function (doc) {
	if (!doc._req) {
		doc._req = {};
	}
	dataStackUtils.eventsUtil.publishEvent('EVENT_DF_DELETE', 'dataFormat', doc._req, doc);
});

mongoose.model('dataFormat', schema, 'b2b.dataFormats');