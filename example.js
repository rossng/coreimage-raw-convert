import fs from 'fs';
import path from 'path';
import { convertRawToJpeg } from './index.js';

// Example usage
async function convertRawFile(inputPath, outputPath) {
  try {
    // Read the RAW file
    console.log(`Reading RAW file: ${inputPath}`);
    const rawBuffer = fs.readFileSync(inputPath);

    // Convert to JPEG
    console.log('Converting RAW to JPEG...');
    const jpegBuffer = convertRawToJpeg(rawBuffer);

    // Write the JPEG file
    fs.writeFileSync(outputPath, jpegBuffer);
    console.log(`JPEG saved to: ${outputPath}`);
    console.log(`File size: ${jpegBuffer.length} bytes`);
  } catch (error) {
    console.error('Error converting RAW to JPEG:', error.message);
  }
}

// Command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node example.js <input.raw> <output.jpg>');
    console.log('');
    console.log(
      'Supported RAW formats include: NEF, CR2, ARW, DNG, RAF, ORF, etc.'
    );
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1];

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
