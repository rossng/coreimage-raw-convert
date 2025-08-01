import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const addon = require('./build/Release/raw_converter');

/**
 * Convert a RAW image buffer to JPEG format
 * @param {Buffer} rawImageBuffer - Buffer containing RAW image data
 * @returns {Buffer} Buffer containing JPEG image data
 */
function convertRawToJpeg(rawImageBuffer) {
  if (!Buffer.isBuffer(rawImageBuffer)) {
    throw new TypeError('Input must be a Buffer');
  }

  if (rawImageBuffer.length === 0) {
    throw new Error('Input buffer is empty');
  }

  return addon.convertRawToJpeg(rawImageBuffer);
}

export { convertRawToJpeg };
