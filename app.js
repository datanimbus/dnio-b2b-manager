if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');
const log4js = require('log4js');
const { AuthCacheMW } = require('@appveen/ds-auth-cache');

const config = require('./config');

const app = express();
const logger = log4js.getLogger('Server');


app.use(express.json({ inflate: true, limit: config.MAX_JSON_SIZE}));
app.use(AuthCacheMW({ secret: config.secret, decodeOnly: true }));
app.use('/api', require('./controllers'));


app.listen(config.port, () => {
    logger.info('HTTP Server is listening on:', config.port);
});

https.createServer({
    cert: fs.readFileSync(path.join(__dirname, 'keys', 'b2b-manager.crt')),
    key: fs.readFileSync(path.join(__dirname, 'keys', 'b2b-manager.key')),
}, app).listen(config.httpsPort, () => {
    logger.info('HTTPs Server is listening on:', config.httpsPort);
});