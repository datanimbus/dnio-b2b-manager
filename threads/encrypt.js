const { workerData, parentPort } = require('worker_threads');
const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const BLOCK_SIZE = 16;

const plainText = workerData.plainText;
const key = workerData.key;
let cipherText;

try {
    const iv = crypto.randomBytes(BLOCK_SIZE);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    cipherText = cipher.update(plainText, 'utf8', 'hex');
    cipherText += cipher.final('hex');
    cipherText = iv.toString('hex') + ':' + cipherText
    parentPort.postMessage({ statusCode: 200, body: cipherText });
} catch (e) {
    cipherText = null;
    parentPort.postMessage({ statusCode: 500, body: e });
}