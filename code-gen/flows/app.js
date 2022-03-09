if (process.env.NODE_ENV !== 'production') {
	require('dotenv').config();
}
const log4js = require('log4js');
const express = require('express');

const config = require('./config');
require('./db-factory');

global.promises = [];

const app = express();
const logger = log4js.getLogger(global.loggerName);

const middlewares = require('./lib.middlewares');

app.use(express.json({ inflate: true, limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(middlewares.addHeaders);

app.use('/api/b2b', require('./route'));

app.use('/api/b2b/internal/health/ready', async function (req, res) {
	try {
		if (global.appcenterDB) {
			return res.status(200).json({ message: 'Alive' });
		}
		return res.status(400).json({ message: 'DB Not Connected' });
	} catch (err) {
		logger.error(err);
		return res.status(500).json({ message: err.message });
	}
});

const server = app.listen(config.port, function () {
	logger.info('Server Listening on port:', config.port);
});

server.setTimeout(300000);