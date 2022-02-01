const { workerData, parentPort } = require('worker_threads');
const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const BLOCK_SIZE = 16;

const cipherText = workerData.cipherText;
const key = workerData.key;
let decrypted;

try {
    // const contents = Buffer.from(cipherText, 'hex');
    // const iv = contents.slice(0, BLOCK_SIZE);
    // const textBytes = contents.slice(BLOCK_SIZE);
    const iv = cipherText.split(':')[0];
    const textBytes = cipherText.split(':')[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
    decrypted = decipher.update(textBytes, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    parentPort.postMessage({ statusCode: 200, body: decrypted });
} catch (e) {
    decrypted = null;
    parentPort.postMessage({ statusCode: 500, body: e });
}