const log4js = require('log4js');
const mongoose = require('mongoose');
const dataStackUtils = require('@appveen/data.stack-utils');
// const utils = require('@appveen/utils');
const _ = require('lodash');

const config = require('../config');
const queue = require('../queue');
const definition = require('../schemas/bundle-deployment.schema').definition;
const mongooseUtils = require('../utils/mongoose.utils.js');
const k8sUtils = require('../utils/k8s.utils');
const commonUtils = require('../utils/common.utils');

const logger = log4js.getLogger(global.loggerName);

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

schema.pre('save', async function (next) {
	try {
		let flowBaseImage;
		const appData = await commonUtils.getApp(this._req, this.app);
		if (appData.body.b2bBaseImage) {
			flowBaseImage = appData.body.b2bBaseImage;
		}
		this.image = flowBaseImage;
		let flowModel = mongoose.model('flow');
		let flowsToDeploy = this.bundle;
		let flowsToUnDeploy = [];
		if (!this.isNew) {
			let bundleModel = mongoose.model('bundle-deployment');
			let oldData = await bundleModel.findOne({ _id: this._id });
			flowsToUnDeploy = _.difference(oldData.bundle, this.bundle);
		}
		this._flowsToUnDeploy = flowsToUnDeploy;
		let flowList = await flowModel.find({ _id: { $in: _.concat(flowsToDeploy, flowsToUnDeploy) } }).select({ _id: 1, deploymentName: 1, namespace: 1 }).exec();
		this.volumeMounts = _.flatten(flowList.map(e => e.volumeMounts));
		let promises = flowList.map(async (doc) => {
			try {
				logger.info('Removing Standalone Service and Deployment for flow :', doc._id);
				if (config.isK8sEnv()) {
					k8sUtils.deleteService(doc);
					k8sUtils.deleteDeployment(doc);
				}
				if (!(flowsToUnDeploy.indexOf(doc._id) > -1)) {
					if (doc.status == 'Active' && this.isNew) {
						this.status = 'Active';
					}
					doc.status = 'Pending';
					let payload = {};
					payload.name = doc.deploymentName;
					payload.namespace = this.namespace;
					payload.selector = this.deploymentName;
					payload.port = 8080;
					if (config.isK8sEnv()) {
						const status = await k8sUtils.upsertBundleService(payload);
						logger.trace(`Service Create status :: ${JSON.stringify(status)}`);
					}
				}
			} catch (err) {
				logger.error(err);
			}
		});
		await Promise.all(promises);
		if (config.isK8sEnv()) {
			if (this.status == 'Active') {
				const status = await k8sUtils.upsertBundleDeployment(this);
				logger.trace(`Deployment Create status :: ${JSON.stringify(status)}`);
			} else {
				const status = await k8sUtils.deleteDeployment(this);
				logger.trace(`Deployment Stop status :: ${JSON.stringify(status)}`);
			}
		}
		next();
	} catch (err) {
		next(err);
	}
});

schema.pre('save', mongooseUtils.generateId('DEP', 'b2b.flows.bundle', null, 4, 2000));

schema.post('save', async function (doc) {
	try {
		if (!doc._flowsToUnDeploy) {
			doc._flowsToUnDeploy = [];
		}
		let flowModel = mongoose.model('flow');
		let flowList = await flowModel.find({ _id: { $in: _.concat(doc.bundle, doc._flowsToUnDeploy) } }).select({ _id: 1, deploymentName: 1, namespace: 1 }).exec();
		let promises = flowList.map(async (item) => {
			try {
				if (doc._flowsToUnDeploy.indexOf(item._id) > -1) {
					if (doc.status == 'Active') {
						item.status = 'Pending';
					} else {
						item.status = 'Stopped';
					}
				} else {
					item.status = 'Pending';
				}
				item.isNew = false;
				item._req = doc._req;
				await item.save();
			} catch (err) {
				logger.error(err);
			}
		});
		await Promise.all(promises);
	} catch (err) {
		logger.error(`Deployment Create Error :: ${JSON.stringify(err)}`);
	}
});

schema.post('save', function (error, doc, next) {
	if ((error.errors && error.errors.name) || error.name === 'ValidationError' || error.message.indexOf('E11000') > -1
		|| error.message.indexOf('__CUSTOM_NAME_DUPLICATE_ERROR__') > -1) {
		next(new Error('Bundle name is already in use'));
	} else {
		next(error);
	}
});

schema.post('remove', async function (doc) {
	try {
		let flowModel = mongoose.model('flow');
		let flowList = await flowModel.find({ _id: { $in: doc.bundle } }).select({ _id: 1, deploymentName: 1, namespace: 1 }).exec();
		let promises = flowList.map(async (item) => {
			try {
				logger.info('Removing Standalone Service and Deployment for flow :', item._id);
				if (config.isK8sEnv()) {
					k8sUtils.deleteService(item).catch((err) => {
						logger.error(`Service Delete Error :: ${JSON.stringify(err)}`);
					});
					k8sUtils.deleteDeployment(item).catch((err) => {
						logger.error(`Deployment Delete Error :: ${JSON.stringify(err)}`);
					});
				}
				if (doc.status == 'Active') {
					item.status = 'Pending';
				} else {
					item.status = doc.status;
				}
				item.isNew = false;
				item._req = doc._req;
				await item.save();
			} catch (err) {
				logger.error(err);
			}
		});
		await Promise.all(promises);
		if (config.isK8sEnv()) {
			let status = await k8sUtils.deleteDeployment(doc);
			logger.trace(`Deployment Delete status :: ${JSON.stringify(status)}`);
		}
	} catch (err) {
		logger.error(`Deployment Delete Error :: ${JSON.stringify(err)}`);
	}
});

mongoose.model('bundle-deployment', schema, 'b2b.flows.bundle');