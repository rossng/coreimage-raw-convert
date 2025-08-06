import fs from 'fs';
import path from 'path';
import { convertRaw, OutputFormat } from '../index.js';

interface FormatMap {
  [key: string]: OutputFormat;
}

// Example usage
async function convertRawFile(
  inputPath: string,
  outputPath: string
): Promise<void> {
  try {
    // Read the RAW file
    console.log(`Reading RAW file: ${inputPath}`);
    const rawBuffer = fs.readFileSync(inputPath);

    // Determine output format from file extension
    const ext = path.extname(outputPath).toLowerCase().substring(1);
    let format: OutputFormat = ext as OutputFormat;

    // Map common extensions to supported format names
    const formatMap: FormatMap = {
      jpg: OutputFormat.JPEG,
      tif: OutputFormat.TIFF,
      jp2: OutputFormat.JPEG2000,
      heic: OutputFormat.HEIF,
    };

    if (formatMap[ext]) {
      format = formatMap[ext];
    }

    // Validate format
    const supportedFormats: OutputFormat[] = [
      OutputFormat.JPEG,
      OutputFormat.PNG,
      OutputFormat.TIFF,
      OutputFormat.JPEG2000,
      OutputFormat.HEIF,
    ];
    if (!supportedFormats.includes(format)) {
      throw new Error(
        `Unsupported output format: ${ext}. Supported formats: jpg, jpeg, png, tif, tiff, jp2, jpeg2000, heif, heic`
      );
    }

    // Convert to specified format
    console.log(`Converting RAW to ${format.toUpperCase()}...`);
    const outputImage = convertRaw(rawBuffer, format);

    // Write the output file
    fs.writeFileSync(outputPath, outputImage.buffer);
    console.log(`${format.toUpperCase()} saved to: ${outputPath}`);
    console.log(`File size: ${outputImage.buffer.length} bytes`);
  } catch (error) {
    console.error('Error converting RAW:', (error as Error).message);
  }
}

// Command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(
      'Usage: node example.js <input.raw> <output.{jpg|png|tif|jp2|heif}>'
    );
    console.log('');
    console.log(
      'Supported input RAW formats: NEF, CR2, ARW, DNG, RAF, ORF, etc.'
    );
    console.log(
      'Supported output formats: jpg, jpeg, png, tif, tiff, jp2, jpeg2000, heif, heic'
    );
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1];

  if (!inputPath || !outputPath) {
    console.error('Both input and output paths are required');
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  convertRawFile(inputPath, outputPath);
}

export { convertRawFile };
