const _ = require('lodash');
const log4js = require('log4js');
const mongoose = require('mongoose');

const dataStackUtils = require('@appveen/data.stack-utils');

const queue = require('../queue');
const config = require('../config');
const mongooseUtils = require('../utils/mongoose.utils');
const definition = require('../schemas/flow.schema').definition;
const helpers = require('../utils/helper');
const k8sUtils = require('../utils/k8s.utils');

const logger = log4js.getLogger(global.loggerName);

const client = queue.getClient();
dataStackUtils.eventsUtil.setNatsClient(client);

const draftDefinition = JSON.parse(JSON.stringify(definition));

const schema = mongooseUtils.MakeSchema(definition);
const draftSchema = mongooseUtils.MakeSchema(draftDefinition);

schema.index({ name: 1, app: 1 }, { unique: true, sparse: true, collation: { locale: 'en_US', strength: 2 } });
schema.index({ 'inputNode.options.path': 1, app: 1 }, { unique: true, sparse: true, collation: { locale: 'en_US', strength: 2 } });

schema.plugin(mongooseUtils.metadataPlugin());
draftSchema.plugin(mongooseUtils.metadataPlugin());


schema.pre('save', function (next) {
	if (!this.inputNode || !this.inputNode.type) {
		return next(new Error('Input Node is Mandatory'));
	}
	this._wasNew = this.isNew;
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

schema.pre('save', async function (next) {
	let doc = this;
	if (!doc._req) {
		doc._req = {};
	}
	if (!doc._req.headers) {
		doc._req.headers = {};
	}
	const txnId = `[${doc._req.headers.TxnId || doc._req.headers.txnId}]`;
	let bundleModel = mongoose.model('bundle-deployment');
	try {
		let bundleDoc = await bundleModel.findOne({ bundle: doc._id }, { name: 1, _id: 1 });
		if (bundleDoc) {
			logger.trace(`[${txnId}] Flow is part of bundle - ${JSON.stringify(bundleDoc)}`);
			return;
		}
		if (config.isK8sEnv() && doc.status != 'Active') {
			let status;
			if (doc.status == 'Pending') {
				status = await k8sUtils.upsertDeployment(doc);
				logger.trace(`[${txnId}] Flow Service Upsert Status - `, status);
				status = await k8sUtils.upsertService(doc);
				logger.trace(`[${txnId}] Flow Deployment Upsert Status - `, status);
			} else {
				try {
					status = await k8sUtils.deleteDeployment(doc);
					logger.trace(`[${txnId}] Flow Service Delete Status - `, status);
				} catch (err) {
					logger.error(`[${txnId}] Flow Service Delete Error - `, err);
				}
				try {
					status = await k8sUtils.deleteService(doc);
					logger.trace(`[${txnId}] Flow Deployment Delete Status - `, status);
				} catch (err) {
					logger.error(`[${txnId}] Flow Service Delete Error - `, err);
				}
			}
		}
	} catch (err) {
		logger.error(`[${txnId}] Flow post save hook - ${JSON.stringify(err)}`);
		next(err);
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
	if (!doc._req.headers) {
		doc._req.headers = {};
	}
	const txnId = `[${doc._req.headers.TxnId || doc._req.headers.txnId}]`;
	const agentActionModel = mongoose.model('agent-action');
	if ((doc.status != 'Draft') && (doc.inputNode.type === 'FILE' || doc.nodes.some(node => node.type === 'FILE'))) {
		let action;
		if (doc.status == 'Stopped') {
			action = 'stop';
		} else if (doc.status == 'Active') {
			action = 'start';
		} else {
			if (doc._wasNew) {
				action = 'create';
			} else {
				action = 'update';
			}
		}
		let flowActionList = helpers.constructFlowEvent('', doc, action);
		flowActionList.forEach(action => {
			const actionDoc = new agentActionModel(action);
			let status = actionDoc.save();
			logger.trace(`[${txnId}] Flow Action Create Status - `, status);
			logger.trace(`[${txnId}] Flow Action Doc - `, actionDoc);
		});
	}
});

schema.post('remove', function (doc) {
	if (!doc._req) {
		doc._req = {};
	}
	if (!doc._req.headers) {
		doc._req.headers = {};
	}
	const txnId = `[${doc._req.headers.TxnId || doc._req.headers.txnId}]`;
	const agentActionModel = mongoose.model('agent-action');
	if (doc.status != 'Draft' && (doc.inputNode.type === 'FILE' || doc.nodes.some(node => node.type === 'FILE'))) {
		let action = 'delete';
		let flowActionList = helpers.constructFlowEvent('', doc, action);
		flowActionList.forEach(action => {
			const actionDoc = new agentActionModel(action);
			let status = actionDoc.save();
			logger.trace(`[${txnId}] Flow Action Create Status - `, status);
			logger.trace(`[${txnId}] Flow Action Doc - `, actionDoc);
		});
	}
});

schema.post('remove', async function (doc) {
	if (!doc._req) {
		doc._req = {};
	}
	if (!doc._req.headers) {
		doc._req.headers = {};
	}
	const txnId = `[${doc._req.headers.TxnId || doc._req.headers.txnId}]`;
	if (config.isK8sEnv()) {
		let status;
		try {
			status = await k8sUtils.deleteDeployment(doc);
			logger.trace(`[${txnId}] Flow Service Delete Status - `, status);
		} catch (err) {
			logger.error(`[${txnId}] Flow Service Delete Error - `, err);
		}
		try {
			status = await k8sUtils.deleteService(doc);
			logger.trace(`[${txnId}] Flow Deployment Delete Status - `, status);
		} catch (err) {
			logger.error(`[${txnId}] Flow Service Delete Error - `, err);
		}
	}
});


schema.pre('remove', dataStackUtils.auditTrail.getAuditPreRemoveHook());


schema.post('remove', dataStackUtils.auditTrail.getAuditPostRemoveHook('b2b.flow.audit', client, 'auditQueue'));


schema.post('remove', function (doc) {
	let appDB = mongoose.connections[1].useDb(config.DATA_STACK_NAMESPACE + '-' + doc.app);
	appDB.dropCollection(`b2b.${doc._id}.interactions`).catch((err) => {
		logger.error(`Error Orrcured while deleting collection - b2b.${doc._id}.interactions`);
		logger.error(err);
	});
	appDB.dropCollection(`b2b.${doc._id}.node-state`).catch((err) => {
		logger.error(`Error Orrcured while deleting collection - b2b.${doc._id}.node-state`);
		logger.error(err);
	});
	appDB.dropCollection(`b2b.${doc._id}.node-state.data`).catch((err) => {
		logger.error(`Error Orrcured while deleting collection - b2b.${doc._id}.node-state.data`);
		logger.error(err);
	});
});


mongoose.model('flow', schema, 'b2b.flows');
mongoose.model('flow.draft', draftSchema, 'b2b.flows.draft');