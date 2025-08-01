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

### convertRawToJpeg(rawBuffer)

Converts a RAW image buffer to JPEG format.

- **Parameters:**
  - `rawBuffer` (Buffer): Buffer containing RAW image data
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
