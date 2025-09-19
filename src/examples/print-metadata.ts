import fs from 'node:fs';
import path from 'node:path';
import { convertRaw, OutputFormat } from '../index.js';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: print-metadata <image-file-path>');
  process.exit(1);
}

const buffer = fs.readFileSync(filePath);
const inputFormat = path.extname(filePath).slice(1).toLowerCase() as any;

const result = convertRaw(buffer, OutputFormat.JPEG, {
  extractMetadata: true,
  inputFormat,
});

console.log(JSON.stringify(result.metadata, null, 2));
