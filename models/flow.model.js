const log4js = require('log4js');
const mongoose = require('mongoose');
const dataStackUtils = require('@appveen/data.stack-utils');
// const utils = require('@appveen/utils');
const _ = require('lodash');

const config = require('../config');
const queue = require('../queue');
const definition = require('../schemas/flow.schema').definition;
const mongooseUtils = require('../utils/mongoose.utils');

const logger = log4js.getLogger(global.loggerName);
const client = queue.getClient();
dataStackUtils.eventsUtil.setNatsClient(client);


const schema = new mongoose.Schema(definition, {
	usePushEach: true,
	versionKey: 'version'
});

schema.index({ name: 1, app: 1 }, { unique: '__CUSTOM_NAME_DUPLICATE_ERROR__', sparse: true, collation: { locale: 'en_US', strength: 2 } });
schema.index({ 'inputStage.options.path': 1, app: 1 }, { unique: '__CUSTOM_API_DUPLICATE_ERROR__', sparse: true, collation: { locale: 'en_US', strength: 2 } });

schema.plugin(mongooseUtils.metadataPlugin());

schema.pre('save', function (next) {
	if (!this.inputStage || !this.inputStage.type) {
		return next(new Error('Input Stage is Mandatory'));
	}
	if (!this.inputStage || !this.inputStage.options) {
		this.inputStage.options = {};
	}
	if (this.inputStage && this.inputStage.options && this.inputStage.options.path && this.inputStage.options.path.trim()) {
		this.inputStage.options.path = this.inputStage.options.path.trim();
		if (this.inputStage.options.path.trim().charAt(0) != '/') {
			this.inputStage.options.path = '/' + this.inputStage.options.path;
		}
	}
	if (!this.inputStage.options.path || !this.inputStage.options.path.trim()) {
		this.inputStage.options.path = '/' + _.camelCase(this.name);
	}
	if (!this.deploymentName) {
		this.deploymentName = 'b2b-' + _.camelCase(this.name).toLowerCase();
	}
	if (!this.namespace) {
		this.namespace = (config.DATA_STACK_NAMESPACE + '-' + this.app).toLowerCase()
	}
	if (!this.version) {
		this.version = 1;
	} else {
		this.version += 1;
	}
	next();
});


schema.post('save', function (error, doc, next) {
	if ((error.errors && error.errors.name) || error.name === 'ValidationError' ||
		error.message.indexOf('E11000') > -1 || error.message.indexOf('__CUSTOM_NAME_DUPLICATE_ERROR__') > -1) {
		logger.error('flow - Flow name is already in use, not saving doc - ' + doc._id);
		next(new Error('Flow name is already in use'));
	} else {
		next(error);
	}
});


schema.pre('save', mongooseUtils.generateId('FLOW', 'b2b.flow', null, 4, 2000));

schema.pre('save', dataStackUtils.auditTrail.getAuditPreSaveHook('b2b.flow'));

schema.post('save', dataStackUtils.auditTrail.getAuditPostSaveHook('b2b.flow.audit', client, 'auditQueue'));

schema.pre('remove', dataStackUtils.auditTrail.getAuditPreRemoveHook());

schema.post('remove', dataStackUtils.auditTrail.getAuditPostRemoveHook('b2b.flow.audit', client, 'auditQueue'));


schema.post('save', function (doc) {
	if (!doc._req) {
		doc._req = {};
	}
	if (doc._isNew) {
		dataStackUtils.eventsUtil.publishEvent('EVENT_FLOW_CREATE', 'b2b.flow', doc._req, doc);
	} else {
		dataStackUtils.eventsUtil.publishEvent('EVENT_FLOW_UPDATE', 'b2b.flow', doc._req, doc);
	}
});

schema.post('remove', function (doc) {
	if (!doc._req) {
		doc._req = {};
	}
	dataStackUtils.eventsUtil.publishEvent('EVENT_FLOW_DELETE', 'b2b.flow', doc._req, doc);
});


mongoose.model('flow', schema, 'b2b.flows');