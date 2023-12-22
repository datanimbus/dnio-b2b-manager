const log4js = require('log4js');
const mongoose = require('mongoose');
const dataStackUtils = require('@appveen/data.stack-utils');
const _ = require('lodash');

const definition = require('../schemas/faas.schema').definition;
const mongooseUtils = require('../utils/mongoose.utils');
const queue = require('../queue');

const startPort = 30010;
const logger = log4js.getLogger(global.loggerName);
const client = queue.getClient();
dataStackUtils.eventsUtil.setNatsClient(client);


const draftDefinition = JSON.parse(JSON.stringify(definition));

const schema = mongooseUtils.MakeSchema(definition);
const draftSchema = mongooseUtils.MakeSchema(draftDefinition);

schema.plugin(mongooseUtils.metadataPlugin());
draftSchema.plugin(mongooseUtils.metadataPlugin());


schema.index({ name: 1, app: 1 }, { unique: true, name: "name", sparse: true, collation: { locale: 'en_US', strength: 2 } });
schema.index({ url: 1, app: 1 }, { unique: true, name: "url", sparse: true, collation: { locale: 'en_US', strength: 2 } });


schema.pre('validate', function (next) {
	const req = this._req;
	let txnId = req && req.headers['TxnId'];
	logger.debug(`[${txnId}] faas - Validating if function name is empty`);
	this.name = this.name.trim();
	this.url = this.url ? this.url.trim() : `/${_.camelCase(this.name)}`;
	if (this.name && _.isEmpty(this.name)) {
		return next(new Error('Function name is empty'));
	}
	next();
});

draftSchema.pre('validate', function (next) {
	const req = this._req;
	let txnId = req && req.headers['TxnId'];
	logger.debug(`[${txnId}] faas.draft - Validating if function name is empty`);
	this.name = this.name.trim();
	this.url = this.url ? this.url.trim() : `/${_.camelCase(this.name)}`;
	if (this.name && _.isEmpty(this.name)) {
		return next(new Error('Function name is empty'));
	}
	next();
});


schema.pre('validate', function (next) {
	try {
		// One extra character for / in api
		let apiregx = /^[a-zA-Z]+[a-zA-Z0-9]*$/;
		var nameregx = /^[a-zA-Z]+[a-zA-Z0-9_ -]*$/;

		let urlSplit = this.url.split('/');

		if (urlSplit[urlSplit.length - 1].match(apiregx)) {
			if (this.name?.match(nameregx)) {
				next();
			} else {
				next(new Error('FAAS_NAME_ERROR :: Name must consist of alphanumeric characters and/or underscore and space and must start with an alphabet.'));
			}
		} else {
			next(new Error('FAAS_NAME_ERROR :: API Endpoint must consist of alphanumeric characters and must start with \'/\' and followed by an alphabet.'));
		}
	} catch (err) {
		logger.error(`[${txnId}] faas - Error validating if API endpoint and name begin with alphabets - ${err}`);
		next(err);
	}
});

draftSchema.pre('validate', function (next) {
	try {
		let apiregx = /^[a-zA-Z]+[a-zA-Z0-9]*$/;
		var nameregx = /^[a-zA-Z]+[a-zA-Z0-9_ -]*$/;

		let urlSplit = this.url.split('/');

		if (urlSplit[urlSplit.length - 1].match(apiregx)) {
			if (this.name?.match(nameregx)) {
				next();
			} else {
				next(new Error('FAAS_NAME_ERROR :: Name must consist of alphanumeric characters and/or underscore and space and must start with an alphabet.'));
			}
		} else {
			next(new Error('FAAS_NAME_ERROR :: API Endpoint must consist of alphanumeric characters and must start with \'/\' and followed by an alphabet.'));
		}
	} catch (err) {
		logger.error(`[${txnId}] faas - Error validating if API endpoint and name begin with alphabets - ${err}`);
		next(err);
	}
});


schema.pre('validate', async function (next) {
	const req = this._req;
	let txnId = req && req.headers['TxnId'];
	try {
		logger.debug(`[${txnId}] faas - Validating if API endpoint is already in use - ${JSON.stringify({ app: this.app, url: this.url, faasId: this._id })}`);
		const faas = await mongoose.model('faas').findOne({ app: this.app, url: this.url, _id: { $ne: this._id } }, { _id: 1 });
		if (faas) {
			return next(new Error('API endpoint is already in use'));
		} else {
			const faasDraft = await mongoose.model('faas.draft').findOne({ app: this.app, url: this.url, _id: { $ne: this._id } }, { _id: 1 });
			if (faasDraft) return next(new Error('API endpoint is already in use in draft'));
		}
		return next();
	} catch (err) {
		logger.error(`[${txnId}] faas - Error validating if API endpoint is in use - ${err}`);
		next(err);
	}
});

schema.pre('validate', async function (next) {
	const req = this._req;
	let txnId = req && req.headers['TxnId'];
	try {
		logger.debug(`[${txnId}] faas - Validating if function name is already in use ${JSON.stringify({ app: this.app, name: this.name, faasId: this._id })}`);

		const faas = await mongoose.model('faas').findOne({ app: this.app, name: this.name, _id: { $ne: this._id } }, { _id: 1 });
		if (faas) {
			return next(new Error('Function name is already in use'));
		} else {
			const faasDraft = await mongoose.model('faas.draft').findOne({ app: this.app, name: this.name, _id: { $ne: this._id } }, { _id: 1 });
			if (faasDraft) {
				return next(new Error('Function name is already in use in draft'));
			}
		}
		return next();
	} catch (err) {
		logger.error(`[${txnId}] faas - Error validating if function name is already in use`);
		next(err);
	}
});


schema.pre('validate', function (next) {
	const req = this._req;
	let txnId = req && req.headers['TxnId'];
	logger.debug(`[${txnId}] faas - Validating if function name is longer than 40 characters - ${this.name}`);
	if (this.name.length > 40) {
		next(new Error('Function name must be less than 40 characters.'));
	} else {
		next();
	}
});

draftSchema.pre('validate', function (next) {
	const req = this._req;
	let txnId = req && req.headers['TxnId'];
	logger.debug(`[${txnId}] faas.draft - Validating if function name is longer than 40 characters ${this.name}`);
	if (this.name.length > 40) {
		next(new Error('Function name must be less than 40 characters.'));
	} else {
		next();
	}
});


schema.pre('validate', function (next) {
	const req = this._req;
	let txnId = req && req.headers['TxnId'];
	logger.debug(`[${txnId}] faas - Validating if function description is more than 250 characters`);
	if (this.description && this.description.length > 250) {
		next(new Error('Function description should not be more than 250 character.'));
	} else {
		next();
	}
});

draftSchema.pre('validate', function (next) {
	const req = this._req;
	let txnId = req && req.headers['TxnId'];
	logger.debug(`[${txnId}] faas.draft - Validating if function description is longer than 250 characters`);
	if (this.description && this.description.length > 250) {
		next(new Error('Function description should not be more than 250 character.'));
	} else {
		next();
	}
});


schema.pre('save', async function (next) {
	const req = this._req;
	let txnId = req && req.headers['TxnId'];
	this._isNew = this.isNew;
	logger.debug(`[${txnId}] faas - Adding API Endpoint and default code`);
	let user = req && req.headers ? req.headers.user : 'AUTO';
	this._metadata.lastUpdatedBy = user;
	this.url = '/api/a/faas/' + this.app + '/' + _.camelCase(this.name);
	if (!this.deploymentName) {
		this.deploymentName = 'faas-' + _.camelCase(this.name).toLowerCase();
	}
	if (!this.namespace) {
		this.namespace = (process.env.DATA_STACK_NAMESPACE + '-' + this.app.toLowerCase().replace(/ /g, '')).toLowerCase();
	}
	if (!this.port) {
		this.port = await getNextPort(req.headers['TxnId']) || 31000;
	}
	if (!this.status) {
		this.status = 'STOPPED';
	}
	if (!this.code || this._isNew) {
		this.code =
			`router.get('/${this.app}/${_.camelCase(this.name)}', async (req, res)=>{

            });
            router.post('/${this.app}/${_.camelCase(this.name)}', async (req, res)=>{

            });
            router.put('/${this.app}/${_.camelCase(this.name)}', async (req, res)=>{

            });
            router.delete('/${this.app}/${_.camelCase(this.name)}', async (req, res)=>{

            });`;
	}
	logger.debug(`[${txnId}] faas - ${JSON.stringify({ url: this.url, code: this.code, status: this.status })}`);
	next();
});

draftSchema.pre('save', function (next) {
	const req = this._req;
	let txnId = req && req.headers['TxnId'];
	this._isNew = this.isNew;
	logger.debug(`[${txnId}] faas.draft - Adding url and default code`);
	let user = req && req.headers ? req.headers.user : 'AUTO';
	this._metadata.lastUpdatedBy = user;
	this.url = '/api/a/faas/' + this.app + '/' + _.camelCase(this.name);
	if (!this.deploymentName) {
		this.deploymentName = 'faas-' + _.camelCase(this.name).toLowerCase();
	}
	if (!this.namespace) {
		this.namespace = (process.env.DATA_STACK_NAMESPACE + '-' + this.app.toLowerCase().replace(/ /g, '')).toLowerCase();
	}
	if (!this.port) {
		this.port = getNextPort(req.headers['TxnId']) || 31000;
	}
	if (!this.status) {
		this.status = 'STOPPED';
	}
	if (!this.code) {
		this.code =
			`router.get('/${this.app}/${_.camelCase(this.name)}', (req, res)=>{

            });
            router.post('/${this.app}/${_.camelCase(this.name)}', (req, res)=>{

            });
            router.put('/${this.app}/${_.camelCase(this.name)}', (req, res)=>{

            });
            router.delete('/${this.app}/${_.camelCase(this.name)}', (req, res)=>{

            });`;
	}
	logger.debug(`[${txnId}] faas.draft - ${JSON.stringify({ url: this.url, code: this.code, status: this.status })}`);
	next();
});


schema.post('save', function (error, doc, next) {
	if ((error.errors && error.errors.name) || error.name === 'ValidationError' ||
		error.message.indexOf('E11000') > -1 || error.message.indexOf('__CUSTOM_NAME_DUPLICATE_ERROR__') > -1) {
		logger.error('faas - Function name is already in use, not saving doc - ' + doc._id);
		logger.trace(error);
		next(new Error('Function name is already in use'));
	} else {
		next(error);
	}
});


schema.pre('save', mongooseUtils.generateId('FS', 'faas', null, 4, 2000));

schema.pre('save', dataStackUtils.auditTrail.getAuditPreSaveHook('faas'));

schema.post('save', dataStackUtils.auditTrail.getAuditPostSaveHook('faas.audit', client, 'auditQueue'));

schema.pre('remove', dataStackUtils.auditTrail.getAuditPreRemoveHook());

schema.post('remove', dataStackUtils.auditTrail.getAuditPostRemoveHook('faas.audit', client, 'auditQueue'));


schema.post('save', function (doc) {
	if (!doc._req) {
		doc._req = {};
	}
	if (doc._isNew) {
		dataStackUtils.eventsUtil.publishEvent('EVENT_FAAS_CREATE', 'faas', doc._req, doc);
	} else {
		dataStackUtils.eventsUtil.publishEvent('EVENT_FAAS_UPDATE', 'faas', doc._req, doc);
	}
});

schema.post('remove', function (doc) {
	if (!doc._req) {
		doc._req = {};
	}
	dataStackUtils.eventsUtil.publishEvent('EVENT_FAAS_DELETE', 'faas', doc._req, doc);
});

async function getNextPort(txnId) {
	logger.debug(`[${txnId}] Fetching the next port number for the function`);

	let docs = await mongoose.model('faas').find({}).select('port').sort({ 'port': 1 }).lean();
	if (docs && docs.length > 0 && docs[0].port)
		return getNextVal(docs);
	else
		return startPort;
}

function getNextVal(_docs) {
	let nextPort = _docs[0].port + 1;
	for (var i = 1; i < _docs.length; i++) {
		if (nextPort !== _docs[i].port) break;
		else nextPort++;
	}
	return nextPort;
}


mongoose.model('faas', schema, 'b2b.faas');
mongoose.model('faas.draft', draftSchema, 'b2b.faas.draft');