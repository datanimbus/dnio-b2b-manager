const log4js = require('log4js');
const mongoose = require('mongoose');
const utils = require('@appveen/utils');
const dataStackUtils = require('@appveen/data.stack-utils');
const _ = require('lodash');

const definition = require('../schemas/partner.schema').definition;
const mongooseUtils = require('../utils/mongoose.utils');
const queue = require('../queue');


const logger = log4js.getLogger(global.loggerName);
const client = queue.getClient();
dataStackUtils.eventsUtil.setNatsClient(client);


const schema = new mongoose.Schema(definition, {
    usePushEach: true
});

schema.plugin(mongooseUtils.metadataPlugin());

schema.index({ name: 1, app: 1 }, { unique: '__CUSTOM_NAME_DUPLICATE_ERROR__', sparse: true, collation: { locale: 'en_US', strength: 2 } });

schema.post('save', function (error, doc, next) {
    if ((error.code === 11000
        || error.message.indexOf('__CUSTOM_NAME_DUPLICATE_ERROR__') > -1
        || error.message.indexOf('E11000') > -1
    )) {
        next(new Error('Partner name is already in use'));
    } else {
        next(error);
    }
});

schema.pre('save', utils.counter.getIdGenerator('PTR', 'partners', null, null, 2000));

schema.pre('save', function (next) {
    this.name = this.name.trim();
    this._isNew = this.isNew;
    if ((_.camelCase(this.app) + '-' + _.camelCase(this.name)).length > 24)
        return next(new Error('Partner name too long'));
    if (this.isNew) this.agentId = uuid();
    next();
});

schema.post('save', async function (doc) {
    const agentName = _.camelCase(doc.app) + '-' + _.camelCase(doc.name);
    let agentPromise = Promise.resolve();
    if (doc._isNew) {
        let agentModel = mongoose.model('agent');
        let obj = {
            agentId: doc.agentId,
            type: 'PARTNERAGENT',
            app: doc.app,
            name: agentName,
            partner: doc._id
        };
        agentPromise = Promise.resolve(new agentModel(obj));
    } else {
        agentPromise = mongoose.model('agent').findOne({ agentId: doc.agentId });
    }
    const agentDoc = await agentPromise;
    agentDoc.name = agentName;
    agentDoc._req = doc._req
    return await agentDoc.save();
});


//Updating Trusted IP list in agent if changed
schema.post('save', async function (doc) {
    if (!doc._oldData) return;
    let oldList = doc._oldData.agentTrustedIP;
    let newList = doc.agentTrustedIP;
    if (!_.isEqual(JSON.parse(JSON.stringify(oldList)), JSON.parse(JSON.stringify(newList)))) {
        let metadata = {
            '_id': doc._id,
            'agentTrustedIP': doc.agentTrustedIP,
        };
        let obj = {
            agentId: doc.agentId,
            app: doc.app,
            partner: doc._id,
            action: 'PARTNER_TRUSTED_IP_LIST_INFO_UPDATED',
            metaData: JSON.stringify(metadata),
            timestamp: new Date().toString(),
            entryType: 'IN',
            sentOrRead: false
        };
        return mongoose.model('agent-action').create(obj);
    }
});

schema.pre('save', dataStackUtils.auditTrail.getAuditPreSaveHook('b2b.partners'));

schema.post('save', dataStackUtils.auditTrail.getAuditPostSaveHook('b2b.partner.audit', client, 'auditQueue'));

schema.pre('remove', dataStackUtils.auditTrail.getAuditPreRemoveHook());

schema.post('remove', dataStackUtils.auditTrail.getAuditPostRemoveHook('b2b.partner.audit', client, 'auditQueue'));

schema.post('remove', async function (doc) {
    try {
        const agentDoc = await mongoose.model('agent').find({ type: 'PARTNERAGENT', partner: doc._id });
        agentDoc._req = doc._req;
        agentDoc.remove();
    } catch (err) {
        logger.error(err);
    }
});


schema.post('save', function (doc) {
    if (!doc._req) {
        doc._req = {};
    }
    if (doc._isNew) {
        dataStackUtils.eventsUtil.publishEvent('EVENT_PARTNER_CREATE', 'partner', doc._req, doc);
    } else {
        dataStackUtils.eventsUtil.publishEvent('EVENT_PARTNER_UPDATE', 'partner', doc._req, doc);
    }
});

schema.post('remove', function (doc) {
    if (!doc._req) {
        doc._req = {};
    }
    dataStackUtils.eventsUtil.publishEvent('EVENT_PARTNER_DELETE', 'partner', doc._req, doc);
});

mongoose.model('partner', schema, 'b2b.partners');