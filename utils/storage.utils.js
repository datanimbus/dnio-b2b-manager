const log4js = require('log4js');
const { BlobServiceClient } = require('@azure/storage-blob');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const logger = log4js.getLogger(global.loggerName);

async function getBufferFromAzureBlob(options) {
	try {
		const blobServiceClient = BlobServiceClient.fromConnectionString(options.connectionString);
		const containerClient = blobServiceClient.getContainerClient(options.container);
		const blockBlobClient = containerClient.getBlockBlobClient(options.blobName);
		const bufferData = await blockBlobClient.downloadToBuffer();
		const stringData = bufferData.toString('utf-8');
		return stringData;
	} catch (err) {
		logger.error('Error While Downloading Blob');
		logger.error(err);
		throw err;
	}
}


async function getBufferFromS3Bucket(options) {
	try {
		const client = new S3Client({
			region: options.region,
			credentials: {
				secretAccessKey: options.secretAccessKey,
				accessKeyId: options.accessKeyId
			}
		});
		const input = {
			Bucket: options.bucket,
			Key: options.blobName
		};
		const command = new GetObjectCommand(input);
		const response = await client.send(command);
		const streamToString = (stream) =>
			new Promise((resolve, reject) => {
				const chunks = [];
				stream.on('data', (chunk) => chunks.push(chunk));
				stream.on('error', reject);
				stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
			});
		const stringData = await streamToString(response.Body);
		return stringData;
	} catch (err) {
		logger.error('Error While Downloading Blob');
		logger.error(err);
		throw err;
	}
}

module.exports.getBufferFromAzureBlob = getBufferFromAzureBlob;
module.exports.getBufferFromS3Bucket = getBufferFromS3Bucket;