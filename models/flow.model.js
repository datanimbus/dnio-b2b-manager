const _ = require('lodash');
const log4js = require('log4js');
const mongoose = require('mongoose');

const dataStackUtils = require('@appveen/data.stack-utils');

const queue = require('../queue');
const config = require('../config');
const mongooseUtils = require('../utils/mongoose.utils');
const definition = require('../schemas/flow.schema').definition;

const logger = log4js.getLogger(global.loggerName);

const client = queue.getClient();
dataStackUtils.eventsUtil.setNatsClient(client);

const draftDefinition = JSON.parse(JSON.stringify(definition));

const schema = mongooseUtils.MakeSchema(definition);
const draftSchema = mongooseUtils.MakeSchema(draftDefinition);
const npmLibrarySchema = mongooseUtils.MakeSchema({ _id: String }, { strict: false });

schema.index({ name: 1, app: 1 }, { unique: true, sparse: true, collation: { locale: 'en_US', strength: 2 } });
schema.index({ 'inputNode.options.path': 1, app: 1 }, { unique: true, sparse: true, collation: { locale: 'en_US', strength: 2 } });

schema.plugin(mongooseUtils.metadataPlugin());
draftSchema.plugin(mongooseUtils.metadataPlugin());
npmLibrarySchema.plugin(mongooseUtils.metadataPlugin());


schema.pre('save', function (next) {
	if (!this.inputNode || !this.inputNode.type) {
		return next(new Error('Input Node is Mandatory'));
	}
	if (this.isNew) {
		if (!this.inputNode || !this.inputNode.options) {
			this.inputNode.options = {};
		}
		if (this.inputNode && this.inputNode.options && this.inputNode.options.path && this.inputNode.options.path.trim()) {
			this.inputNode.options.path = this.inputNode.options.path.trim();
			if (this.inputNode.options.path.trim().charAt(0) != '/') {
				this.inputNode.options.path = '/' + this.inputNode.options.path;
			}
		}
		if (!this.inputNode.options.path || !this.inputNode.options.path.trim()) {
			this.inputNode.options.path = '/' + _.camelCase(this.name);
		}
		if (this.nodes && this.nodes.length == 1 && this.inputNode.type == 'FILE' && this.nodes[0].type == 'FILE' && !this.inputNode.dataStructure) {
			this.isBinary = true;
		}
		if (!this.deploymentName) {
			this.deploymentName = 'b2b-' + _.camelCase(this.name).toLowerCase();
		}
		if (!this.namespace) {
			this.namespace = (config.DATA_STACK_NAMESPACE + '-' + this.app).toLowerCase();
		}
	}
	this.increment();
	next();
});

draftSchema.pre('save', function (next) {
	if (!this.inputNode || !this.inputNode.type) {
		return next(new Error('Input Node is Mandatory'));
	}
	if (this.isNew) {
		if (!this.inputNode || !this.inputNode.options) {
			this.inputNode.options = {};
		}
		if (this.inputNode && this.inputNode.options && this.inputNode.options.path && this.inputNode.options.path.trim()) {
			this.inputNode.options.path = this.inputNode.options.path.trim();
			if (this.inputNode.options.path.trim().charAt(0) != '/') {
				this.inputNode.options.path = '/' + this.inputNode.options.path;
			}
		}
		if (!this.inputNode.options.path || !this.inputNode.options.path.trim()) {
			this.inputNode.options.path = '/' + _.camelCase(this.name);
		}
		if (this.nodes && this.nodes.length == 1 && this.inputNode.type == 'FILE' && this.nodes[0].type == 'FILE' && !this.inputNode.dataStructure) {
			this.isBinary = true;
		}
		if (!this.deploymentName) {
			this.deploymentName = 'b2b-' + _.camelCase(this.name).toLowerCase();
		}
		if (!this.namespace) {
			this.namespace = (config.DATA_STACK_NAMESPACE + '-' + this.app).toLowerCase();
		}
	}
	this.increment();
	next();
});


schema.pre('save', function (next) {
	// One extra character for / in api
	let apiregx = /^\/[a-zA-Z]+[a-zA-Z0-9/{}]*$/;
	var nameregx = /^[a-zA-Z]+[a-zA-Z0-9_ -]*$/;

	if (this.inputNode?.options?.path?.length > 40) {
		return next(new Error('API endpoint length cannot be greater than 40'));
	}

	if (this.inputNode?.options?.path?.match(apiregx)) {
		if (this.name?.match(nameregx)) {
			next();
		} else {
			next(new Error('FLOW_NAME_ERROR :: Name must consist of alphanumeric characters and/or underscore and space and must start with an alphabet.'));
		}
	} else {
		next(new Error('FLOW_NAME_ERROR :: API Endpoint must consist of alphanumeric characters and must start with \'/\' and followed by an alphabet.'));
	}
});

draftSchema.pre('save', function (next) {
	// One extra character for / in api
	let apiregx = /^\/[a-zA-Z]+[a-zA-Z0-9/{}]*$/;
	var nameregx = /^[a-zA-Z]+[a-zA-Z0-9_ -]*$/;

	if (this.inputNode?.options?.path?.length > 40) {
		return next(new Error('API endpoint length cannot be greater than 40'));
	}

	if (this.inputNode?.options?.path?.match(apiregx)) {
		if (this.name?.match(nameregx)) {
			next();
		} else {
			next(new Error('FLOW_NAME_ERROR :: Name must consist of alphanumeric characters and/or underscore and space and must start with an alphabet.'));
		}
	} else {
		next(new Error('FLOW_NAME_ERROR :: API Endpoint must consist of alphanumeric characters and must start with \'/\' and followed by an alphabet.'));
	}
});


schema.pre('save', mongooseUtils.generateId('FLOW', 'b2b.flow', null, 4, 2000));
npmLibrarySchema.pre('save', mongooseUtils.generateId('CONFIG', 'config.b2b.libraries', null, 4, 2000));

schema.pre('save', dataStackUtils.auditTrail.getAuditPreSaveHook('b2b.flow'));



schema.post('save', function (error, doc, next) {
	if ((error.errors && error.errors.name) || error.name === 'ValidationError' ||
		error.message.indexOf('E11000') > -1 || error.message.indexOf('__CUSTOM_NAME_DUPLICATE_ERROR__') > -1) {
		logger.error('flow - Flow name is already in use, not saving doc - ' + doc._id);
		logger.error(error);
		next(new Error('Flow name is already in use'));
	} else {
		next(error);
	}
});


schema.post('save', dataStackUtils.auditTrail.getAuditPostSaveHook('b2b.flow.audit', client, 'auditQueue'));


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



schema.pre('remove', dataStackUtils.auditTrail.getAuditPreRemoveHook());


schema.post('remove', dataStackUtils.auditTrail.getAuditPostRemoveHook('b2b.flow.audit', client, 'auditQueue'));


schema.post('remove', function (doc) {
	if (!doc._req) {
		doc._req = {};
	}
	dataStackUtils.eventsUtil.publishEvent('EVENT_FLOW_DELETE', 'b2b.flow', doc._req, doc);
});


mongoose.model('flow', schema, 'b2b.flows');
mongoose.model('flow.draft', draftSchema, 'b2b.flows.draft');
mongoose.model('b2b.libraries', npmLibrarySchema, 'config.b2b.libraries');