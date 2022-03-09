module.exports = (logger) => {
	return (req, res, next) => {
		// process.stdout.write('\x1Bc')
		let width = process.stdout.columns;
		let line = '';
		while (width > 0) {
			line += '═';
			width--;
		}
		console.log(line);
		let url = [];
		let api = req.originalUrl.split('?');
		logger.info(`${req.method} ${req.originalUrl}`);
		logger.info('Headers :: ');
		for (_k in req.headers) logger.info(`HEADERS -> ${_k} : ${req.headers[_k]}`);
		if (['POST', 'PUT'].indexOf(req.method) != -1) {
			logger.info('Payload :: ');
			logger.info(JSON.stringify(req.body, null, ' '));
		}
		res.on('close', function () {
			logger.info(`Request completed for ${req.originalUrl}`);
		});
		next();
	};
};