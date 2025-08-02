import { createRequire } from 'module';

const addon = createRequire(import.meta.url)('../build/Release/raw_converter');

/**
 * Supported output formats for image conversion
 */
export type OutputFormat =
  | 'jpeg'
  | 'jpg'
  | 'png'
  | 'tiff'
  | 'tif'
  | 'jpeg2000'
  | 'jp2'
  | 'heif'
  | 'heic';

/**
 * Configuration options for RAW image conversion
 */
export interface ConversionOptions {
  /** Enable vendor lens correction (default: true) */
  lensCorrection?: boolean;

  /** Exposure adjustment in EV stops (default: 0.0) */
  exposure?: number;

  /** Boost amount (0.0-1.0, where 0 is linear response) (default: 1.0) */
  boost?: number;

  /** Amount to boost shadow areas (default: 0.0) */
  boostShadowAmount?: number;

  /** Baseline exposure adjustment (default: 0.0) */
  baselineExposure?: number;

  /** Color temperature in Kelvin for neutral white */
  neutralTemperature?: number;

  /** Tint adjustment for neutral white */
  neutralTint?: number;

  /** Disable gamut mapping (default: false) */
  disableGamutMap?: boolean;

  /** Allow draft mode rendering for faster processing (default: false) */
  allowDraftMode?: boolean;

  /** Ignore image orientation metadata (default: false) */
  ignoreImageOrientation?: boolean;

  /** Amount of chroma noise reduction (0.0-1.0) */
  colorNoiseReductionAmount?: number;

  /** Amount of luminance noise reduction (0.0-1.0) */
  luminanceNoiseReductionAmount?: number;

  /** Amount of local contrast for edges */
  contrastAmount?: number;

  /** Amount of sharpness for edges */
  sharpnessAmount?: number;

  /** Amount of noise reduction */
  noiseReductionAmount?: number;

  /** Amount of local tone curve (macOS 11.1+) */
  localToneMapAmount?: number;

  /** Scale factor for output image (default: 1.0) */
  scaleFactor?: number;
}

/**
 * Native addon interface
 */
interface RawConverterAddon {
  convertRaw(
    rawImageBuffer: Buffer,
    format: string,
    options: ConversionOptions
  ): Buffer;
}

/**
 * Convert a RAW image buffer to the specified format
 * @param rawImageBuffer - Buffer containing RAW image data
 * @param format - Output format. Supported formats: 'jpeg', 'jpg', 'png', 'tiff', 'tif', 'jpeg2000', 'jp2', 'heif', 'heic'
 * @param options - Conversion options
 * @throws {TypeError} If rawImageBuffer is not a Buffer or format is not a string
 * @throws {Error} If the buffer is empty or format is unsupported
 * @returns Buffer containing image data in the specified format
 */
export function convertRaw(
  rawImageBuffer: Buffer,
  format: OutputFormat,
  options: ConversionOptions = {}
): Buffer {
  if (!Buffer.isBuffer(rawImageBuffer)) {
    throw new TypeError('Input must be a Buffer');
  }

  if (rawImageBuffer.length === 0) {
    throw new Error('Input buffer is empty');
  }

  if (typeof format !== 'string' || format.trim() === '') {
    throw new TypeError('Format must be a non-empty string');
  }

  const normalizedFormat = format.toLowerCase().trim() as OutputFormat;
  const supportedFormats: OutputFormat[] = [
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

  return (addon as RawConverterAddon).convertRaw(
    rawImageBuffer,
    normalizedFormat,
    options
  );
}

/**
 * Convert a RAW image buffer to JPEG format
 * @deprecated Use `convertRaw` instead
 * @param rawImageBuffer - Buffer containing RAW image data
 * @param options - Conversion options (see `convertRaw` for options)
 * @returns Buffer containing JPEG image data
 */
export function convertRawToJpeg(
  rawImageBuffer: Buffer,
  options: ConversionOptions = {}
): Buffer {
  return convertRaw(rawImageBuffer, 'jpeg', options);
}
