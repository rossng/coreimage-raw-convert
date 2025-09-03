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
 * Image metadata extracted from RAW files using Core Image
 */
export interface ImageMetadata {
  /** Image width in pixels */
  width?: number;
  /** Image height in pixels */
  height?: number;
  /** 35mm equivalent focal length in mm */
  focalLength35mm?: number;
  /** Shutter speed in seconds (e.g., 0.008 for 1/125s) */
  shutterSpeed?: number;
  /** F-number (aperture) */
  fNumber?: number;
  /** Camera make */
  cameraMake?: string;
  /** Camera model */
  cameraModel?: string;
}

/**
 * Output image with buffer and optional metadata
 */
export interface OutputImage {
  /** Image buffer containing the converted data */
  buffer: Buffer;
  /** Image metadata (only populated if extractMetadata option is enabled) */
  metadata?: ImageMetadata;
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

  /** Extract and include image metadata in the output (default: false) */
  extractMetadata?: boolean;

  /** Input RAW format (required when input is a Buffer, ignored for file paths) */
  inputFormat?:
    | 'arw'
    | 'dng'
    | 'cr2'
    | 'nef'
    | 'raf'
    | 'orf'
    | 'rw2'
    | 'pef'
    | 'srw'
    | 'x3f'
    | 'raw';
}

/**
 * Internal options interface that combines conversion options with quality options
 */
interface InternalConversionOptions extends ConversionOptions {
  quality?: number;
  embedThumbnail?: boolean;
  optimizeColorForSharing?: boolean;
  preserveExifData?: boolean;
  extractMetadata?: boolean;
}

/**
 * Native addon interface
 */
interface RawConverterAddon {
  convertRaw(
    input: Buffer | string,
    format: string,
    options: InternalConversionOptions
  ): OutputImage;
  convertRawAsync(
    input: Buffer | string,
    format: string,
    options: InternalConversionOptions,
    callback: (error: Error | null, result?: OutputImage) => void
  ): void;
}

/**
 * Convert a RAW image to the specified format with type-safe options
 * @param input - Buffer containing RAW image data or file path to RAW image
 * @param format - Output format (enum value)
 * @param options - Format-specific conversion options
 * @throws {TypeError} If input is not a Buffer or string
 * @throws {Error} If the buffer is empty, file doesn't exist, or format is unsupported
 * @returns OutputImage containing buffer and optional metadata
 */
export function convertRaw<F extends OutputFormat>(
  input: Buffer | string,
  outputFormat: F,
  options?: ConversionOptions & FormatQualityOptions[F]
): OutputImage {
  if (!Buffer.isBuffer(input) && typeof input !== 'string') {
    throw new TypeError('Input must be a Buffer or file path string');
  }

  if (Buffer.isBuffer(input) && input.length === 0) {
    throw new Error('Input buffer is empty');
  }

  if (typeof input === 'string' && input.trim() === '') {
    throw new Error('File path cannot be empty');
  }

  if (typeof outputFormat !== 'string' || outputFormat.trim() === '') {
    throw new TypeError('Output format must be a non-empty string');
  }

  const normalizedFormat = outputFormat.toLowerCase().trim() as F;
  const supportedFormats = Object.values(OutputFormat);

  if (!supportedFormats.includes(normalizedFormat)) {
    throw new Error(
      `Unsupported output format: ${outputFormat}. Supported formats: ${supportedFormats.join(', ')}`
    );
  }

  // Validate inputFormat for Buffer inputs
  if (Buffer.isBuffer(input) && !options?.inputFormat) {
    throw new Error('inputFormat is required when input is a Buffer');
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
 * @returns Promise<OutputImage> containing buffer and optional metadata
 */
export function convertRawAsync<F extends OutputFormat>(
  input: Buffer | string,
  outputFormat: F,
  options?: ConversionOptions & FormatQualityOptions[F]
): Promise<OutputImage> {
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

    if (typeof outputFormat !== 'string' || outputFormat.trim() === '') {
      reject(new TypeError('Output format must be a non-empty string'));
      return;
    }

    const normalizedFormat = outputFormat.toLowerCase().trim() as F;
    const supportedFormats = Object.values(OutputFormat);

    if (!supportedFormats.includes(normalizedFormat)) {
      reject(
        new Error(
          `Unsupported output format: ${outputFormat}. Supported formats: ${supportedFormats.join(', ')}`
        )
      );
      return;
    }

    // Validate inputFormat for Buffer inputs
    if (Buffer.isBuffer(input) && !options?.inputFormat) {
      reject(new Error('inputFormat is required when input is a Buffer'));
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
      (error: Error | null, result?: OutputImage) => {
        if (error) {
          reject(error);
        } else if (result) {
          // The native extension now returns OutputImage object for all formats
          resolve(result);
        } else {
          reject(new Error('Unknown error occurred during conversion'));
        }
      }
    );
  });
}
