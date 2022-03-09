const fs = require('fs');
const path = require('path');
const express = require('express');
// const MongoClient = require('mongodb').MongoClient;
// const mongoose = require('mongoose');
const fileUpload = require('express-fileupload');
const Schedule = require('node-schedule');
const log4js = require('log4js');

if (process.env.NODE_ENV != 'production') {
  require('dotenv').config();
}

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

log4js.configure({
  appenders: { 'out': { type: 'stdout' } },
  categories: { default: { appenders: ['out'], level: LOG_LEVEL } }
});

const utils = require('@appveen/utils');
const config = require('./config');

if (!fs.existsSync('./downloads')) {
  fs.mkdirSync('./downloads');
}

const loggerName = config.isK8sEnv() ? `[${process.env.DATA_STACK_NAMESPACE}] [${process.env.HOSTNAME}]` : config.dataStackFaasName;
// const logger = utils.logger.getLogger.getLogger(loggerName);
const logger = log4js.getLogger(loggerName);

global.loggerName = loggerName;
global.logger = logger;
global.activeRequest = 0;
global.dbPromises = [];

const queue = require('./utils/queue.utils');

// Import after global logger is set.
const functionUtils = require('./utils/faas.utils');

logger.debug('************** ENV VARIABLES **************');
logger.debug(JSON.stringify(process.env, null, 2));
logger.debug('*******************************************');

let app = express();

// MongoClient.connect(config.mongoAppcenterUrl, config.mongoAppcenterOptions).then(client => {
//   global.client = client;
//   global.dataDB = client.db(config.dataDB);
//   // global.configDB = client.db(config.configDB);
//   // global.logsDB = client.db(config.logsDB);
//   client.on('connecting', () => { logger.info(`-------------------------${config.dataDB} connecting-------------------------`); });
//   client.on('close', () => { logger.error(`-------------------------${config.dataDB} lost connection-------------------------`); });
//   client.on('reconnect', () => { logger.info(`-------------------------${config.dataDB} reconnected-------------------------`); });
//   client.on('connected', () => { logger.info(`${config.dataDB} connected`); });
//   client.on('reconnectFailed', () => { logger.error(`-------------------------${config.dataDB} failed to reconnect-------------------------`); });
// }).catch(err => {
//   logger.error('Unable to connect to MongoDB');
//   logger.error(err);
//   process.exit(0);
// });

// config.mongoAppcenterOptions.dbName = config.dataDB;
// mongoose.connect(config.mongoAppcenterUrl, config.mongoAppcenterOptions, function (err) {
//   if (err) {
//     logger.error(err);
//     process.exit(0);
//   } else {
//     global.dataDB = mongoose.connection.db;
//     logger.info(`Connected to ${config.dataDB} DB`);
//     logger.trace(`Connected to URL: ${mongoose.connection.host}`);
//     logger.trace(`Connected to DB:${mongoose.connection.name}`);
//     logger.trace(`Connected via User: ${mongoose.connection.user}`);
//     functionUtils.informPM();
//     mongoose.connection.db.admin().serverInfo()
//       .then(data => {
//         global.mongodVersion = data.version;
//         logger.info('mongodb version ' + global.mongodVersion);
//       });
//   }
// });

// mongoose.connection.on('connecting', () => {
//   logger.info(`------------------------- Connecting ${config.dataDB} -------------------------`);
// });
// mongoose.connection.on('disconnected', () => {
//   logger.error(`------------------------- Lost Connection ${config.dataDB} -------------------------`);
// });
// mongoose.connection.on('reconnect', () => {
//   logger.info(`------------------------- Reconnected ${config.dataDB} -------------------------`);
// });
// mongoose.connection.on('reconnectFailed', () => {
//   logger.error(`------------------------- Failed to Reconnect ${config.dataDB} -------------------------`);
//   process.exit(0);
// });

app.use((req, res, next) => {
  // Deny new requests, if process kill request was recieved
  // if (global.stopServer) {
  //   return res.status(400).json({ message: 'Server has stopped accepting requests' });
  // }
  if (req.path.split('/').indexOf('health') == -1) {
    logger.trace(req.path, req.method, req.headers);
    queue.client.publish(config.faasLastInvokedQueue, JSON.stringify({ _id: config.dataStackFaasId, startTime: (new Date()).toISOString() }));
  }
  global.activeRequest++;
  res.on('close', function () {
    global.activeRequest--;
    if (req.path.split('/').indexOf('health') === -1) {
      logger.trace(`============= REQUEST COMPLETED FOR ${req.path} =============`);
    }
  });
  next();
});

app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: './uploads'
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.raw({ type: ['application/xml', 'text/xml'] }));
app.use(express.json({ inflate: true, limit: '100mb' }));

// Api endpoint of functions
app.use('/api', require('./routes'));

// Global Error Handler
app.use(function (err, req, res, next) {
  logger.error('Handling global error - ', err.stack);

  let errorData = functionUtils.getErrorResponse(err, 500);

  logger.error('Global error - ', errorData);

  res.status(500).json(errorData)
});

// Start Server
const server = app.listen(config.port, function (err) {
  if (err) {
    logger.error(err);
  } else {
    logger.info('Server started on port ', config.port);
    functionUtils.informPM();
    // global.job = Schedule.scheduleJob('0 */2 * * *', cleanUpJob);
    // global.pullJob = Schedule.scheduleJob('*/2 * * * *', pullJob);
    // global.pullJob = setInterval(() => {
    //   pullJob(new Date().toISOString());
    // }, 120000);
  }
});

// Server Timeout for 2 hr
server.setTimeout(7200000);

process.on('SIGTERM', () => {
  try {
    // Handle Request for 15 sec then stop recieving
    setTimeout(() => {
      global.stopServer = true;
    }, 15000);
    logger.info('Process Kill Request Recieved');
    // Stopping CRON Job;
    // global.job.cancel();
    // global.pullJob.cancel();
    // clearInterval(global.pullJob)
    const intVal = setInterval(() => {
      // Waiting For all pending requests to finish;
      if (global.activeRequest === 0) {
        // Closing Express Server;
        server.close(() => {
          logger.info('Server Stopped.');
          // Waiting For all DB Operations to finish;
          // Promise.all(global.dbPromises).then(() => {
          //   // Closing MongoDB Connection;
          //   if (mongoose.connection) {
          //     mongoose.connection.close(false, (err) => {
          //       logger.info('MongoDB connection closed.');
          //       process.exit(0);
          //     });
          //   } else {
          //     process.exit(0);
          //   }
          // }).catch(err => {
          //   // Closing MongoDB Connection;
          //   if (mongoose.connection) {
          //     mongoose.connection.close(false, (err) => {
          //       logger.info('MongoDB connection closed.');
          //       process.exit(0);
          //     });
          //   } else {
          //     process.exit(0);
          //   }
          // });
        });
        clearInterval(intVal);
      } else {
        logger.info('Waiting for request to complete, Active Requests:', global.activeRequest);
      }
    }, 2000);
  } catch (e) {
    logger.error(e);
    throw e;
  }
});


// function cleanUpJob(firetime) {
//   let counter = 0;
//   try {
//     const date = new Date();
//     date.setSeconds(-7200);
//     logger.trace('Clean up Job Triggred at:', firetime);
//     logger.trace('Removing files older then:', date.toISOString());
//     const uploads = fs.readdirSync('./uploads', {
//       withFileTypes: true
//     });
//     const downloads = fs.readdirSync('./downloads', {
//       withFileTypes: true
//     });
//     uploads.forEach(file => {
//       try {
//         const filePath = path.join(__dirname, 'uploads', file.name);
//         if (file.isFile()) {
//           const lastAccessTime = fs.statSync(filePath).atimeMs;
//           if (lastAccessTime < date.getTime()) {
//             logger.debug('Removing old file:', file.name);
//             fs.unlinkSync(filePath);
//             counter++;
//           }
//         }
//         logger.trace('Clean up Job Completed. Removed files:');
//       } catch (e) {
//         logger.warn('Unable to remove old file', file.name);
//         logger.warn(e);
//       }
//     });
//     downloads.forEach(file => {
//       try {
//         const filePath = path.join(__dirname, 'downloads', file.name);
//         if (file.isFile()) {
//           const lastAccessTime = fs.statSync(filePath).atimeMs;
//           if (lastAccessTime < date.getTime()) {
//             logger.debug('Removing old file:', file.name);
//             fs.unlinkSync(filePath);
//             counter++;
//           }
//         }
//         logger.trace('Clean up Job Completed. Removed files:');
//       } catch (e) {
//         logger.warn('Unable to remove old file', file.name);
//         logger.warn(e);
//       }
//     });

//     // Cleaing DB Promises
//     const len = global.dbPromises.length;
//     for (let index = len - 1; index >= 0; index--) {
//       const item = global.dbPromises[index];
//       isFinished(item).then(flag => {
//         if (flag) {
//           global.dbPromises.splice(index, 1);
//         }
//       }).catch(() => { });
//     }
//   } catch (e) {
//     logger.warn('Unable to complete cleanup job. Removed files:', counter);
//     logger.warn(e);
//   }
// }

// function pullJob(firetime) {
//   logger.debug('CRON triggred for pull request to B2BGW', firetime);
//   functionUtils.pullInteraction();
// }


// function delay(msec, value) {
//   return new Promise(done => window.setTimeout((() => done(value)), msec));
// }

// function isFinished(promise) {
//   return Promise.race([delay(0, false), promise.then(() => true, () => true)]);
// }
