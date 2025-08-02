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
import { convertRaw } from 'coreimage-raw-convert';

// Convert to JPEG
const rawBuffer = fs.readFileSync('photo.nef');
const jpegBuffer = convertRaw(rawBuffer, 'jpeg');
fs.writeFileSync('photo.jpg', jpegBuffer);

// Convert to PNG
const pngBuffer = convertRaw(rawBuffer, 'png');
fs.writeFileSync('photo.png', pngBuffer);

// Convert to TIFF
const tiffBuffer = convertRaw(rawBuffer, 'tiff');
fs.writeFileSync('photo.tif', tiffBuffer);
```

## Examples

### Running Examples

The project includes several TypeScript examples. Use the npm scripts to run them:

```bash
# Convert a RAW file from command line
npm run example -- input.raw output.jpg

# Convert to different formats
npm run example -- input.raw output.png
npm run example -- input.raw output.tif

# Interactive web demo with all conversion options
npm run demo

# Load and display a sample image
npm run load-image

# Performance benchmark
npm run benchmark

# Benchmark with custom parameters
npm run benchmark -- --lens-correction "true,false" --quality "0.1,0.5,0.9" --format "jpeg,tif" --draft-mode "true,false" --boost "0.0,1.0" --iterations 10
```

### Example Usage from TypeScript/JavaScript

Convert a RAW file from command line:

```bash
# Convert to JPEG (default)
npm run example -- input.raw output.jpg

# Convert to PNG
npm run example -- input.raw output.png

# Convert to TIFF
npm run example -- input.raw output.tif
```

Try out the various conversion options with the interactive web demo:

```bash
npm run demo
```

## API

### convertRaw(rawBuffer, format, options)

Converts a RAW image buffer to the specified format using Core Image's CIRAWFilter.

- **Parameters:**
  - `rawBuffer` (Buffer): Buffer containing RAW image data
  - `format` (string): Output format. Supported formats:
    - `'jpeg'`, `'jpg'` - JPEG format with 90% quality
    - `'png'` - PNG format (lossless)
    - `'tiff'`, `'tif'` - TIFF format
    - `'jpeg2000'`, `'jp2'` - JPEG 2000 format
    - `'heif'`, `'heic'` - HEIF/HEIC format with 90% quality
  - `options` (Object, optional): Conversion options (see below)
- **Returns:** Buffer containing image data in the specified format
- **Throws:** Error if conversion fails or format is unsupported

### convertRawToJpeg(rawBuffer, options)

Legacy function that converts a RAW image buffer to JPEG format. This is equivalent to calling `convertRaw(rawBuffer, 'jpeg', options)`.

- **Conversion Options:** - `lensCorrection` (boolean): Enable vendor lens correction. Default: `true` - `allowDraftMode` (boolean): Allow draft mode rendering for faster processing. Default: `false` - `ignoreImageOrientation` (boolean): Ignore image orientation metadata. Default: `false`
  - **Exposure & Tone:**
    - `exposure` (number): Exposure adjustment in EV stops. Default: `0.0`
    - `boost` (number): Boost amount (0.0-1.0, where 0 is linear response). Default: `1.0`
    - `boostShadowAmount` (number): Amount to boost shadow areas. Default: `0.0`
    - `baselineExposure` (number): Baseline exposure adjustment. Default: `0.0`
  - **Color & White Balance:**
    - `neutralTemperature` (number): Color temperature in Kelvin for neutral white
    - `neutralTint` (number): Tint adjustment for neutral white
    - `disableGamutMap` (boolean): Disable gamut mapping. Default: `false`
  - **Noise Reduction:**
    - `colorNoiseReductionAmount` (number): Amount of chroma noise reduction (0.0-1.0)
    - `luminanceNoiseReductionAmount` (number): Amount of luminance noise reduction (0.0-1.0)
    - `noiseReductionAmount` (number): General noise reduction amount
  - **Enhancement:**
    - `contrastAmount` (number): Amount of local contrast for edges
    - `sharpnessAmount` (number): Amount of sharpness for edges
  - **Advanced:**
    - `localToneMapAmount` (number): Amount of local tone curve (requires macOS 11.1+)
    - `scaleFactor` (number): Scale factor for output image. Default: `1.0`

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
