if (process.env.NODE_ENV !== 'production') {
	require('dotenv').config();
}

const socket = require('socket.io');
const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');
const log4js = require('log4js');
const { AuthCacheMW } = require('@appveen/ds-auth-cache');
const fileUpload = require('express-fileupload');

const config = require('./config');
require('./db-factory');

const logger = log4js.getLogger(global.loggerName);
logger.level = process.env.LOG_LEVEL || 'info';
global.activeRequest = 0;
global.logger = logger;

function initSocket(server) {
	const io = socket(server);
	app.set('socket', io);
	global.socket = io;
	logger.info('Initializing socket connection');
	io.on('connection', function (socket) {
		logger.info('Connection accepted from : ' + socket.id);
	});
}

let permittedUrls = [
	'/{app}/flow/utils/{id}/init',
	'/{app}/faas/utils/{id}/init',
	'/auth/login',
	'/faas/fetchAll',
	'/{app}/faas/utils/{id}/statusChange',
	'/internal/app/{id}',
	'/internal/health/live',
	'/internal/health/ready'
];

const app = express();

app.use(express.json({ inflate: true, limit: config.MAX_JSON_SIZE }));
app.use(express.urlencoded({ extended: true }));
app.use(express.raw({ type: ['application/xml', 'text/xml', 'application/octet-stream'] }));

app.use((req, res, next) => {
	if (req.path.split('/').indexOf('live') == -1 && req.path.split('/').indexOf('ready') == -1) {
		logger.info(req.method, req.path, req.query);
		logger.trace(`[${req.get(global.txnIdHeader)}] req.path : ${req.path}`);
		logger.trace(`[${req.get(global.txnIdHeader)}] req.headers : ${JSON.stringify(req.headers)} `);
	}
	global.activeRequest++;
	res.on('close', function () {
		global.activeRequest--;
		if (req.path.split('/').indexOf('live') == -1 && req.path.split('/').indexOf('ready') == -1) {
			logger.debug(`[${req.get(global.txnIdHeader)}] Request completed for ${req.originalUrl}`);
		}
	});
	next();
});

//testing comment

app.use(['/b2b/pipes'], require('./router'));
app.use(fileUpload({
	useTempFiles: true,
	tempFileDir: './uploads'
}));
app.use(['/bm', '/b2b/bm'], AuthCacheMW({ permittedUrls: permittedUrls, secret: config.RBAC_JWT_KEY, decodeOnly: true }), require('./controllers'));

const server = app.listen(config.port, () => {
	logger.info('HTTP Server is listening on:', config.port);
});

const httpsServer = https.createServer({
	cert: fs.readFileSync(path.join(__dirname, 'keys', 'b2b-manager.crt')),
	key: fs.readFileSync(path.join(__dirname, 'keys', 'b2b-manager.key')),
}, app).listen(config.httpsPort, () => {
	logger.info('HTTPs Server is listening on:', config.httpsPort);
});

initSocket(server);

process.on('SIGTERM', () => {
	try {
		// Handle Request for 15 sec then stop recieving
		setTimeout(() => {
			global.stopServer = true;
		}, 15000);
		logger.info('Process Kill Request Recieved');
		const intVal = setInterval(() => {
			// Waiting For all pending requests to finish;
			if (global.activeRequest === 0) {
				// Closing Express Server;
				httpsServer.close(() => {
					logger.info('HTTPs Server Stopped.');
				});
				server.close(() => {
					logger.info('HTTP Server Stopped.');
					process.exit(0);
				});
				clearInterval(intVal);
			} else {
				logger.info('Waiting for request to complete, Active Requests:', global.activeRequest);
			}
		}, 2000);
	} catch (e) {
		logger.error('SIGTERM Handler', e);
		process.exit(0);
	}
});