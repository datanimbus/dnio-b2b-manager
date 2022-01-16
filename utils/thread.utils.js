const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');

let logger = global.logger;

/**
 * 
 * @param {string} file The name of file to be executed in a thread
 * @param {object} data The data to send in thread
 */
function executeThread(req, file, data) {
    const txnId = req.header['txnId'];
    logger.debug(`[${txnId}] Exec. thread :: ${file}`);
    return new Promise((resolve, reject) => {
        let responseSent = false;
        const filePath = path.join(process.cwd(), 'api/threads', `${file}.js`);
        if (!fs.existsSync(filePath)) {
            logger.error(`[${txnId}] Exec. thread :: ${file} :: INVALID_FILE`);
            return reject(new Error('INVALID_FILE'));
        }
        const worker = new Worker(filePath, {
            workerData: data
        });
        worker.on('message', function (data) {
            responseSent = true;
            worker.terminate();
            resolve(data);
        });
        worker.on('error', reject);
        worker.on('exit', code => {
            if (!responseSent) {
                logger.error(`[${txnId}] Exec. thread :: ${file} :: Worker stopped with exit code ${code}`);
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
}

module.exports.executeThread = executeThread;