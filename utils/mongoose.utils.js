const mongoose = require('mongoose');
const _ = require('lodash');
const config = require('../config');

function MakeSchema(definition, options) {
	if (definition) {
		const temp = {
			type: {
				lastUpdated: {
					type: 'Date',
					default: Date.now
				},
				createdAt: {
					type: 'Date',
					default: Date.now
				},
				deleted: {
					type: 'Boolean',
					default: false
				},
				version: {
					type: {
						document: {
							type: 'Number',
							default: 0
						}
					}
				}
			},
			default: () => {
				return {
					createdAt: Date.now(),
					lastUpdated: Date.now(),
					deleted: false,
					version: {
						document: 0
					}
				};
			}
		};
		if (!definition._metadata) {
			definition._metadata = {};
		}
		definition._metadata = _.merge(temp, definition._metadata);
		definition._expireAt = {
			type: Date
		};
		if (options) {
			return new mongoose.Schema(definition, options);
		}
		return new mongoose.Schema(definition);
	}
}

/**
 * 
 * @param {*} [options]
 */
function metadataPlugin() {
	return function (schema) {
		// schema.add({
		// 	_expireAt: {
		// 		type: Date,
		// 	},
		// 	_metadata: {
		// 		deleted: {
		// 			type: Boolean,
		// 			default: false
		// 		},
		// 		lastUpdated: {
		// 			type: Date,
		// 			default: Date.now()
		// 		},
		// 		createdAt: {
		// 			type: Date
		// 		},
		// 		version: {
		// 			type: Object
		// 		}
		// 	}
		// });
		schema.index({ '_expireAt': 1 }, { expireAfterSeconds: 0 });
		schema.index({
			'_metadata.lastUpdated': 1
		});
		schema.index({
			'_metadata.createdAt': 1
		});
		schema.pre('save', function (next) {
			const self = this;
			if (!self._metadata) {
				self._metadata = {};
			}
			self._metadata.deleted = false;
			if (!self._metadata.version) {
				self._metadata.version = {};
			}
			if (self._metadata.version) {
				self._metadata.version.release = config.release || 'dev';
			}
			if (!self._metadata.version.document) {
				self._metadata.version.document = 0;
			}
			self._metadata.version.document++;
			if (self.isNew) {
				self._metadata.createdAt = new Date();
			}
			self._wasNew = self.isNew;
			self._metadata.lastUpdated = new Date();
			self.markModified('_metadata');
			next();
		});
	};
}



function generateId(prefix, counterName, suffix, padding, counter) {
	return async function (next) {
		if (this._id) {
			return next();
		}
		let tempId = await createId(prefix, counterName, suffix, padding, counter);
		this._id = tempId;
		next();
	};
}

async function createId(prefix, counterName, suffix, padding, counter) {
	if (padding && typeof padding !== 'number') {
		throw new Error('Padding is not a number');
	}
	if (counter && typeof counter !== 'number') {
		throw new Error('Counter is not a number');
	}
	const doc = await getCount(counterName);
	let tempId = parseInt(doc.next + '', 10);
	if (counter && counter > 0) {
		tempId = parseInt(doc.next + '', 10) + counter;
	}
	if (padding && padding > 0) {
		tempId = _.padStart(tempId + '', padding, '0');
	}
	if (prefix) {
		tempId = prefix + tempId;
	}
	if (suffix) {
		tempId = tempId + suffix;
	}
	return tempId;
}


async function getCount(counterName) {
	const authorDB = global.authorDB;
	const collection = authorDB.collection('counters');
	return ((await collection.findOneAndUpdate({ _id: counterName }, { $inc: { next: 1 } }, { upsert: true })).value || 0);
}


// function rand(_i) {
// 	var i = Math.pow(10, _i - 1);
// 	var j = Math.pow(10, _i) - 1;
// 	return ((Math.floor(Math.random() * (j - i + 1)) + i));
// }


module.exports.createId = createId;
module.exports.generateId = generateId;
module.exports.metadataPlugin = metadataPlugin;
module.exports.MakeSchema = MakeSchema;