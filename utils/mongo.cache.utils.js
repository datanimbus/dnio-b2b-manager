const log4js = require('log4js');
const mongoose = require('mongoose');
const { v4: uuid } = require('uuid');
// const config = require('../config');

const logger = log4js.getLogger(global.loggerName);

async function listData(filter) {
	try {
		const doc = await mongoose.connection.db.collection('av-cache').find(filter).toArray();
		return doc;
	} catch (err) {
		logger.error(err);
		throw err;
	}
}

async function getData(key) {
	try {
		const doc = await mongoose.connection.db.collection('av-cache').findOne({ key });
		return doc;
	} catch (err) {
		logger.error(err);
		throw err;
	}
}

async function setData(key, data, expireAfter) {
	try {
		let tempTimestamp = new Date();
		if (expireAfter) {
			tempTimestamp = new Date(expireAfter);
		}
		const payload = {
			_id: uuid(),
			key,
			data,
			status: 'Enabled',
			timestamp: tempTimestamp
		};
		const doc = await mongoose.connection.db.collection('av-cache').findOneAndUpdate({ key }, { $set: payload }, { upsert: true });
		return doc;
	} catch (err) {
		logger.error(err);
		throw err;
	}
}

async function patchData(key, data) {
	try {
		const payload = {
			data
		};
		const doc = await mongoose.connection.db.collection('av-cache').findOneAndUpdate({ key }, { $set: payload });
		return doc;
	} catch (err) {
		logger.error(err);
		throw err;
	}
}

async function setStatus(key, status) {
	try {
		const doc = await mongoose.connection.db.collection('av-cache').findOneAndUpdate({ key }, { status });
		return doc;
	} catch (err) {
		logger.error(err);
		throw err;
	}
}

async function deleteData(key) {
	try {
		const status = await mongoose.connection.db.collection('av-cache').deleteMany({ key });
		return status;
	} catch (err) {
		logger.error(err);
		throw err;
	}
}


module.exports = {
	listData,
	getData,
	setData,
	patchData,
	setStatus,
	deleteData
};