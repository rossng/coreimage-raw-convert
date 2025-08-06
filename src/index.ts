import { createRequire } from 'module';

const addon = createRequire(import.meta.url)('../build/Release/raw_converter');

/**
 * Supported output formats for image conversion
 */
export enum OutputFormat {
  JPEG = 'jpeg',
  JPG = 'jpg',
  PNG = 'png',
  TIFF = 'tiff',
  TIF = 'tif',
  JPEG2000 = 'jpeg2000',
  JP2 = 'jp2',
  HEIF = 'heif',
  HEIC = 'heic',
  RGB = 'rgb',
}

/**
 * Quality settings for JPEG formats
 */
export interface JpegQualityOptions {
  /** Compression quality (0.0-1.0, where 1.0 is highest quality) */
  quality?: number;
  /** Enable thumbnail embedding (default: false) */
  embedThumbnail?: boolean;
  /** Optimize color for sharing (default: false) */
  optimizeColorForSharing?: boolean;
}

/**
 * Quality settings for HEIF/HEIC formats
 */
export interface HeifQualityOptions {
  /** Compression quality (0.0-1.0, where 1.0 is highest quality) */
  quality?: number;
  /** Enable thumbnail embedding (default: false) */
  embedThumbnail?: boolean;
  /** Optimize color for sharing (default: false) */
  optimizeColorForSharing?: boolean;
}

/**
 * Quality settings for JPEG2000 formats
 */
export interface Jpeg2000QualityOptions {
  /** Compression quality (0.0-1.0, where 1.0 is highest quality) */
  quality?: number;
  /** Optimize color for sharing (default: false) */
  optimizeColorForSharing?: boolean;
}

/**
 * Quality settings for PNG format (lossless)
 */
export interface PngQualityOptions {
  /** Optimize color for sharing (default: false) */
  optimizeColorForSharing?: boolean;
}

/**
 * Quality settings for TIFF format (lossless)
 */
export interface TiffQualityOptions {
  /** Optimize color for sharing (default: false) */
  optimizeColorForSharing?: boolean;
}

/**
 * Quality settings for RGB format (raw bitmap data)
 */
export interface RgbQualityOptions {
  /** No options for raw RGB format */
}

/**
 * Mapping from format to format-specific quality options
 */
export type FormatQualityOptions = {
  [OutputFormat.JPEG]: JpegQualityOptions;
  [OutputFormat.JPG]: JpegQualityOptions;
  [OutputFormat.HEIF]: HeifQualityOptions;
  [OutputFormat.HEIC]: HeifQualityOptions;
  [OutputFormat.JPEG2000]: Jpeg2000QualityOptions;
  [OutputFormat.JP2]: Jpeg2000QualityOptions;
  [OutputFormat.PNG]: PngQualityOptions;
  [OutputFormat.TIFF]: TiffQualityOptions;
  [OutputFormat.TIF]: TiffQualityOptions;
  [OutputFormat.RGB]: RgbQualityOptions;
};

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

  /** Preserve EXIF metadata from the original RAW file (default: true) */
  preserveExifData?: boolean;
}

/**
 * Internal options interface that combines conversion options with quality options
 */
interface InternalConversionOptions extends ConversionOptions {
  quality?: number;
  embedThumbnail?: boolean;
  optimizeColorForSharing?: boolean;
  preserveExifData?: boolean;
}

/**
 * Native addon interface
 */
interface RawConverterAddon {
  convertRaw(
    input: Buffer | string,
    format: string,
    options: InternalConversionOptions
  ): Buffer;
  convertRawAsync(
    input: Buffer | string,
    format: string,
    options: InternalConversionOptions,
    callback: (error: Error | null, result?: Buffer) => void
  ): void;
}

/**
 * Convert a RAW image to the specified format with type-safe options
 * @param input - Buffer containing RAW image data or file path to RAW image
 * @param format - Output format (enum value)
 * @param options - Format-specific conversion options
 * @throws {TypeError} If input is not a Buffer or string
 * @throws {Error} If the buffer is empty, file doesn't exist, or format is unsupported
 * @returns Buffer containing image data in the specified format
 */
export function convertRaw<F extends OutputFormat>(
  input: Buffer | string,
  format: F,
  options?: ConversionOptions & FormatQualityOptions[F]
): Buffer {
  if (!Buffer.isBuffer(input) && typeof input !== 'string') {
    throw new TypeError('Input must be a Buffer or file path string');
  }

  if (Buffer.isBuffer(input) && input.length === 0) {
    throw new Error('Input buffer is empty');
  }

  if (typeof input === 'string' && input.trim() === '') {
    throw new Error('File path cannot be empty');
  }

  if (typeof format !== 'string' || format.trim() === '') {
    throw new TypeError('Format must be a non-empty string');
  }

  const normalizedFormat = format.toLowerCase().trim() as OutputFormat;
  const supportedFormats = Object.values(OutputFormat);

  if (!supportedFormats.includes(normalizedFormat)) {
    throw new Error(
      `Unsupported format: ${format}. Supported formats: ${supportedFormats.join(', ')}`
    );
  }

  // Handle options
  const mergedOptions: InternalConversionOptions = options || {};

  if (mergedOptions !== null && typeof mergedOptions !== 'object') {
    throw new TypeError('Options must be an object');
  }

  return (addon as RawConverterAddon).convertRaw(
    input,
    normalizedFormat,
    mergedOptions
  );
}

/**
 * Convert a RAW image to the specified format asynchronously with type-safe options
 * @param input - Buffer containing RAW image data or file path to RAW image
 * @param format - Output format (enum value)
 * @param options - Format-specific conversion options
 * @throws {TypeError} If input is not a Buffer or string
 * @throws {Error} If the buffer is empty, file doesn't exist, or format is unsupported
 * @returns Promise<Buffer> containing image data in the specified format
 */
export function convertRawAsync<F extends OutputFormat>(
  input: Buffer | string,
  format: F,
  options?: ConversionOptions & FormatQualityOptions[F]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Input validation
    if (!Buffer.isBuffer(input) && typeof input !== 'string') {
      reject(new TypeError('Input must be a Buffer or file path string'));
      return;
    }

    if (Buffer.isBuffer(input) && input.length === 0) {
      reject(new Error('Input buffer is empty'));
      return;
    }

    if (typeof input === 'string' && input.trim() === '') {
      reject(new Error('File path cannot be empty'));
      return;
    }

    if (typeof format !== 'string' || format.trim() === '') {
      reject(new TypeError('Format must be a non-empty string'));
      return;
    }

    const normalizedFormat = format.toLowerCase().trim() as OutputFormat;
    const supportedFormats = Object.values(OutputFormat);

    if (!supportedFormats.includes(normalizedFormat)) {
      reject(
        new Error(
          `Unsupported format: ${format}. Supported formats: ${supportedFormats.join(', ')}`
        )
      );
      return;
    }

    // Handle options
    const mergedOptions: InternalConversionOptions = options || {};

    if (mergedOptions !== null && typeof mergedOptions !== 'object') {
      reject(new TypeError('Options must be an object'));
      return;
    }

    // Call native async function
    (addon as RawConverterAddon).convertRawAsync(
      input,
      normalizedFormat,
      mergedOptions,
      (error: Error | null, result?: Buffer) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve(result);
        } else {
          reject(new Error('Unknown error occurred during conversion'));
        }
      }
    );
  });
}
