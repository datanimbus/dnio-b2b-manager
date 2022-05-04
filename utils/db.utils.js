const config = require('../config');
const fs = require('fs');
const { logger } = require('@appveen/utils');
const GridFSBucket = require('mongodb').GridFSBucket;

function uploadFiletoDB(uploadHeaders, data) {
    return new Promise((resolve,reject) => {
        logger.debug('Uploading file to DB');
    let dbName = config.DATA_STACK_NAMESPACE + uploadHeaders.appName;
    let bucket = new GridFSBucket(dbName, {
        bucketName: 'B2B.' + uploadHeaders.deploymentName
    });

    let fileName = uploadHeaders.originalFileName;
    let readStream = fs.createReadStream(data);
    let uploadStream = bucket.openUploadStream(fileName, {
        chunkSizeBytes: 255 * 1024,
        metadata: {
            originalFileName: fileName
        }
    });

    let id = uploadStream.id;
    let returnObj;

    uploadStream.on('error', (err) => {
        logger.error('Error uploading file ', err.message);
        logger.error(err);
        reject(err);
    });

    uploadStream.on('finish', () => {
        logger.info('File successfully uploaded to ' + dbName + ' and stored under Mongo ObjectID: ' + id.toHexString());
        returnObj = {
            EFileID: id.toHexString(),
            FileName: fileName
        }
        resolve(returnObj);
    });

    readStream.pipe(uploadStream);
    });
};

module.exports = {
    uploadFiletoDB
};