const log4js = require('log4js');
const { BlobServiceClient } = require('@azure/storage-blob');

const logger = log4js.getLogger(global.loggerName);

async function getBufferFromAzureBlob(options) {
	try {
		const blobServiceClient = BlobServiceClient.fromConnectionString(options.connectionString);
		const containerClient = blobServiceClient.getContainerClient(options.container);
		const blockBlobClient = containerClient.getBlockBlobClient(options.blobName);
		let data = await blockBlobClient.downloadToBuffer();
		return data;
	} catch (err) {
		logger.error('Error While Uploading Blob');
		logger.error(err);
		throw err;
	}
}

module.exports.getBufferFromAzureBlob = getBufferFromAzureBlob;