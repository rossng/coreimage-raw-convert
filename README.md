# CoreImage RAW Convert

A Node.js native addon for converting RAW images to JPEG using macOS Core Image framework.

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

```javascript
import fs from 'fs';
import { convertRawToJpeg } from 'coreimage-raw-convert';

const rawBuffer = fs.readFileSync('photo.nef');
const jpegBuffer = convertRawToJpeg(rawBuffer);
fs.writeFileSync('photo.jpg', jpegBuffer);
```

## Example

Convert a RAW file from command line:

```bash
node example.js input.raw output.jpg
```

## API

### convertRawToJpeg(rawBuffer, options)

Converts a RAW image buffer to JPEG format using Core Image's CIRAWFilter.

- **Parameters:**
  - `rawBuffer` (Buffer): Buffer containing RAW image data
  - `options` (Object, optional): Conversion options
    - **Basic Options:**
      - `lensCorrection` (boolean): Enable vendor lens correction. Default: `true`
      - `allowDraftMode` (boolean): Allow draft mode rendering for faster processing. Default: `false`
      - `ignoreImageOrientation` (boolean): Ignore image orientation metadata. Default: `false`
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
- **Returns:** Buffer containing JPEG image data
- **Throws:** Error if conversion fails

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
