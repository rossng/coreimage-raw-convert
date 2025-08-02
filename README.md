# CoreImage RAW Convert

A Node.js native addon for converting RAW images to various formats using macOS Core Image framework.

[preview.webm](https://github.com/user-attachments/assets/793a76c0-6b81-47ea-b155-02445fe38a48)

## Features

- Uses macOS Core Image's CIRAWFilter for RAW processing
- Supports various RAW formats (NEF, CR2, ARW, DNG, RAF, ORF, etc.)
- Objective-C++ addon

## Requirements

- macOS
- Node.js
- Python (for node-gyp)
- Xcode Command Line Tools

## Usage

Install:

```bash
npm i coreimage-raw-convert
```

Use:

```javascript
import fs from 'fs';
import { convertRaw, OutputFormat } from 'coreimage-raw-convert';

// Convert to JPEG
const rawBuffer = fs.readFileSync('photo.nef');
const jpegBuffer = convertRaw(rawBuffer, OutputFormat.JPEG);
fs.writeFileSync('photo.jpg', jpegBuffer);

// Convert to PNG
const pngBuffer = convertRaw(rawBuffer, OutputFormat.PNG);
fs.writeFileSync('photo.png', pngBuffer);

// Convert to TIFF
const tiffBuffer = convertRaw(rawBuffer, OutputFormat.TIFF);
fs.writeFileSync('photo.tif', tiffBuffer);
```

## Examples

The project includes several TypeScript examples. Use the npm scripts to run them:

```bash
# Convert a RAW file from command line
npm run example -- input.raw output.jpg

# Convert to different formats
npm run example -- input.raw output.png
npm run example -- input.raw output.tif

# Interactive web demo with all conversion options
npm run demo

# Performance benchmark
npm run benchmark

# Benchmark with custom parameters
npm run benchmark -- --lens-correction "true,false" --quality "0.1,0.5,0.9" --format "jpeg,tif" --draft-mode "true,false" --boost "0.0,1.0" --iterations 10
```

## Build from Source

```bash
# Install dependencies
npm install

# Configure build
npm run configure

# Build the addon
npm run build
```

## License

BlueOak-1.0.0
