const log4js = require('log4js');
const mongoose = require('mongoose');
const dataStackUtils = require('@appveen/data.stack-utils');

const definition = require('../schemas/custom-node.schema').definition;
const mongooseUtils = require('../utils/mongoose.utils');

const logger = log4js.getLogger(global.loggerName);
const queue = require('../queue');

const client = queue.getClient();
dataStackUtils.eventsUtil.setNatsClient(client);

const schema = mongooseUtils.MakeSchema(definition);

schema.plugin(mongooseUtils.metadataPlugin());


schema.index({ name: 1, app: 1 }, { unique: true, name: 'UNIQUE_INDEX', collation: { locale: 'en_US', strength: 2 } });
schema.index({ type: 1 });

schema.pre('save', function (next) {
	let regex = /^[a-zA-Z0-9_\s\-\\.]*$/;
	this._isNew = this.isNew;
	// this.app = 'admin';
	if (!this.params) {
		this.params = [];
	}
	if (!this.name) return next(new Error('Node name is required'));
	if (!this.type) return next(new Error('Node Type is required'));
	// if (!this.category) return next(new Error('Node Category is required'));
	if (this.name && this.name.length > 24) return next(new Error('Node name cannot be more than 24 characters'));
	if (this.name && regex.test(this.name)) return next();
	return next(new Error('Node name can contain alphanumeric characters with spaces, dashes and underscores only'));
});

schema.post('save', function (error, doc, next) {
	logger.error(error);
	if (error && error.message && (error.code === 11000
		|| error.message.indexOf('E11000') > -1
	)) {
		if (error.message.indexOf('type') > -1) {
			return next(new Error('Node Type is already in use'));
		}
		// if (error.message.indexOf('category') > -1) {
		// 	return next(new Error('Node Category is already in use'));
		// }
		return next(new Error('Node name is already in use'));
	} else {
		next(error);
	}
});

schema.pre('save', mongooseUtils.generateId('NODE', 'b2b.nodes', null, 4, 2000));

schema.pre('save', dataStackUtils.auditTrail.getAuditPreSaveHook('b2b.nodes'));

schema.post('save', dataStackUtils.auditTrail.getAuditPostSaveHook('b2b.nodes.audit', client, 'auditQueue'));

schema.pre('remove', dataStackUtils.auditTrail.getAuditPreRemoveHook());

schema.post('remove', dataStackUtils.auditTrail.getAuditPostRemoveHook('b2b.nodes.audit', client, 'auditQueue'));


mongoose.model('node', schema, 'b2b.nodes');



const configSchema = mongooseUtils.MakeSchema({ _id: 'String', label: 'String', value: 'String' });

configSchema.plugin(mongooseUtils.metadataPlugin());
mongoose.model('b2b.category', configSchema, 'config.b2b.category');