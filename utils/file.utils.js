const crypto = require('crypto');
var zlib = require('zlib');
const ALGORITHM = 'aes-256-gcm';

function createHash(key) {
    const encodedString = crypto.createHash('md5').update(key).digest("hex");
    return encodedString;
}

function compress(data) {
    const deflated = zlib.deflateSync(data);
    return deflated;
}

function encryptDataGCM(data, key) {
    const compressedData = compress(Buffer.from(data));
    const hashedkey = createHash(key);
    const nonce = crypto.randomBytes(12);
    var cipher = crypto.createCipheriv(ALGORITHM, hashedkey, nonce);
    const encrypted = Buffer.concat([nonce, cipher.update(Buffer.from(compressedData).toString("base64")), cipher.final(), cipher.getAuthTag()]);
    return Buffer.from(encrypted).toString("base64");;
}

function decompress(decryptedBuffer) {
    const inflated = zlib.inflateSync(decryptedBuffer);
    const inflatedString = inflated.toString();
    return inflatedString;
}

function decryptDataGCM(nonceCiphertextTag, key) {
    const hashedkey = createHash(key);
    nonceCiphertextTag = Buffer.from(nonceCiphertextTag, 'base64');
    let nonce = nonceCiphertextTag.slice(0, 12);
    let ciphertext = nonceCiphertextTag.slice(12, -16);
    let tag = nonceCiphertextTag.slice(-16);
    let decipher = crypto.createDecipheriv(ALGORITHM, hashedkey, nonce);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(ciphertext, null, 'utf8') + decipher.final('utf8');

    const decompressedData = decompress(Buffer.from(decrypted, 'base64'));
    return decompressedData;
}

module.exports.encryptDataGCM = encryptDataGCM;
module.exports.decryptDataGCM = decryptDataGCM;
module.exports.createHash = createHash;