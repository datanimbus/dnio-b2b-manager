const log4js = require('log4js');

const logger = log4js.getLogger(global.loggerName);

function getPaginationData(req) {
	const data = {
		skip: 0,
		count: 30,
		select: '',
		sort: ''
	};
	if (req.query.count && (+req.query.count) > 0) {
		data.count = +req.query.count;
	}
	if (req.query.page && (+req.query.page) > 0) {
		data.skip = data.count * ((+req.query.page) - 1);
	}
	if (req.query.select && req.query.select.trim()) {
		data.select = req.query.select ? req.query.select.split(',').join(' ') : '';
	}
	if (req.query.sort && req.query.sort.trim()) {
		data.sort = req.query.sort;
	}
	return data;
}

function IsString(val) {
	return val && val.constructor.name === 'String';
}

function CreateRegexp(str) {
	if (str.charAt(0) === '/' &&
		str.charAt(str.length - 1) === '/') {
		var text = str.substr(1, str.length - 2).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
		return new RegExp(text, 'i');
	} else {
		return str;
	}
}

function IsArray(arg) {
	return arg && arg.constructor.name === 'Array';
}

function IsObject(arg) {
	return arg && arg.constructor.name === 'Object';
}

function ResolveArray(arr) {
	for (var x = 0; x < arr.length; x++) {
		if (IsObject(arr[x])) {
			arr[x] = FilterParse(arr[x]);
		} else if (IsArray(arr[x])) {
			arr[x] = ResolveArray(arr[x]);
		} else if (IsString(arr[x])) {
			arr[x] = CreateRegexp(arr[x]);
		}
	}
	return arr;
}

function FilterParse(filterParsed) {
	for (var key in filterParsed) {
		if (IsString(filterParsed[key])) {
			filterParsed[key] = CreateRegexp(filterParsed[key]);
		} else if (IsArray(filterParsed[key])) {
			filterParsed[key] = ResolveArray(filterParsed[key]);
		} else if (IsObject(filterParsed[key])) {
			filterParsed[key] = FilterParse(filterParsed[key]);
		}
	}
	return filterParsed;
}

function isString(val) {
	return val && val.constructor && val.constructor.name === 'String';
}

function createRegexp(str) {
	if (str.charAt(0) === '/' &&
		str.charAt(str.length - 1) === '/') {
		var text = str.substr(1, str.length - 2).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
		return new RegExp(text, 'i');
	} else {
		return str;
	}
}
function isArray(arg) {
	return arg && arg.constructor && arg.constructor.name === 'Array';
}

function isObject(arg) {
	return arg && arg.constructor && arg.constructor.name === 'Object';
}

function resolveArray(arr) {
	for (var x = 0; x < arr.length; x++) {
		if (isObject(arr[x])) {
			arr[x] = parseFilter(arr[x]);
		} else if (isArray(arr[x])) {
			arr[x] = resolveArray(arr[x]);
		} else if (isString(arr[x])) {
			arr[x] = createRegexp(arr[x]);
		}
	}
	return arr;
}

function parseFilter(filter) {
	let filterParsed = {};
	if (!filter) {
		return filterParsed;
	}
	filterParsed = filter;
	try {
		if (typeof filterParsed == 'string') {
			filterParsed = JSON.parse(filterParsed);
		}
	} catch (e) {
		filterParsed = filter;
		logger.error(e);
	}
	for (var key in filterParsed) {
		if (isString(filterParsed[key])) {
			filterParsed[key] = createRegexp(filterParsed[key]);
		} else if (isArray(filterParsed[key])) {
			filterParsed[key] = resolveArray(filterParsed[key]);
		} else if (isObject(filterParsed[key])) {
			filterParsed[key] = parseFilter(filterParsed[key]);
		}
	}
	return filterParsed;
}


module.exports.getPaginationData = getPaginationData;
module.exports.parseFilter = parseFilter;