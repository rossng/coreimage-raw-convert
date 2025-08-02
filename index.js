import { createRequire } from 'module';
const addon = createRequire(import.meta.url)('./build/Release/raw_converter');

/**
 * Convert a RAW image buffer to the specified format
 * @param {Buffer} rawImageBuffer - Buffer containing RAW image data
 * @param {string} format - Output format. Supported formats: 'jpeg', 'jpg', 'png', 'tiff', 'tif', 'jpeg2000', 'jp2', 'heif', 'heic'
 * @param {Object} [options] - Conversion options
 * @param {boolean} [options.lensCorrection=true] - Enable vendor lens correction
 * @param {number} [options.exposure=0.0] - Exposure adjustment in EV stops
 * @param {number} [options.boost=1.0] - Boost amount (0.0-1.0, where 0 is linear response)
 * @param {number} [options.boostShadowAmount=0.0] - Amount to boost shadow areas
 * @param {number} [options.baselineExposure=0.0] - Baseline exposure adjustment
 * @param {number} [options.neutralTemperature] - Color temperature in Kelvin for neutral white
 * @param {number} [options.neutralTint] - Tint adjustment for neutral white
 * @param {boolean} [options.disableGamutMap=false] - Disable gamut mapping
 * @param {boolean} [options.allowDraftMode=false] - Allow draft mode rendering for faster processing
 * @param {boolean} [options.ignoreImageOrientation=false] - Ignore image orientation metadata
 * @param {number} [options.colorNoiseReductionAmount] - Amount of chroma noise reduction (0.0-1.0)
 * @param {number} [options.luminanceNoiseReductionAmount] - Amount of luminance noise reduction (0.0-1.0)
 * @param {number} [options.contrastAmount] - Amount of local contrast for edges
 * @param {number} [options.sharpnessAmount] - Amount of sharpness for edges
 * @param {number} [options.noiseReductionAmount] - Amount of noise reduction
 * @param {number} [options.localToneMapAmount] - Amount of local tone curve (macOS 11.1+)
 * @param {number} [options.scaleFactor=1.0] - Scale factor for output image
 * @throws {TypeError} If rawImageBuffer is not a Buffer or format is not a string
 * @throws {Error} If the buffer is empty or format is unsupported
 * @returns {Buffer} Buffer containing image data in the specified format
 */
function convertRaw(rawImageBuffer, format, options = {}) {
  if (!Buffer.isBuffer(rawImageBuffer)) {
    throw new TypeError('Input must be a Buffer');
  }

  if (rawImageBuffer.length === 0) {
    throw new Error('Input buffer is empty');
  }

  if (typeof format !== 'string' || format.trim() === '') {
    throw new TypeError('Format must be a non-empty string');
  }

  const normalizedFormat = format.toLowerCase().trim();
  const supportedFormats = [
    'jpeg',
    'jpg',
    'png',
    'tiff',
    'tif',
    'jpeg2000',
    'jp2',
    'heif',
    'heic',
  ];

  if (!supportedFormats.includes(normalizedFormat)) {
    throw new Error(
      `Unsupported format: ${format}. Supported formats: ${supportedFormats.join(', ')}`
    );
  }

  if (options !== null && typeof options !== 'object') {
    throw new TypeError('Options must be an object');
  }

  return addon.convertRaw(rawImageBuffer, normalizedFormat, options);
}

// Export the new function
export { convertRaw };

/**
 * Convert a RAW image buffer to JPEG format
 * @deprecated Use `convertRaw` instead
 * @param {Buffer} rawImageBuffer - Buffer containing RAW image data
 * @param {Object} [options] - Conversion options (see `convertRaw` for options)
 * @returns {Buffer} Buffer containing JPEG image data
 */
function convertRawToJpeg(rawImageBuffer, options = {}) {
  return convertRaw(rawImageBuffer, 'jpeg', options);
}

export { convertRawToJpeg };
