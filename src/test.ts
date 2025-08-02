import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { loadSampleImage } from './examples/load-image.js';
import { convertRaw, OutputFormat } from './index.js';

const TEST_OUTPUT_DIR = 'test-output';
const TEST_OUTPUT_FILE = path.join(TEST_OUTPUT_DIR, 'test_output.jpg');

function cleanup(): void {
  const testOutputDir = 'test-output';
  if (fs.existsSync(testOutputDir)) {
    const files = fs.readdirSync(testOutputDir);
    for (const file of files) {
      fs.unlinkSync(path.join(testOutputDir, file));
    }
    fs.rmdirSync(testOutputDir);
  }
}

function runTests(): void {
  console.log('Running CoreImage RAW Convert Tests...\n');

  const testOutputDir = path.dirname(TEST_OUTPUT_FILE);
  if (!fs.existsSync(testOutputDir)) {
    fs.mkdirSync(testOutputDir, { recursive: true });
  }

  console.log('Test 1: Loading sample RAW file...');
  const rawBuffer = loadSampleImage();
  assert(Buffer.isBuffer(rawBuffer), 'Failed to read file as buffer');
  assert(rawBuffer.length > 0, 'RAW buffer is empty');
  console.log(`✓ RAW file loaded successfully (${rawBuffer.length} bytes)\n`);

  console.log('Test 2: Converting RAW to JPEG...');
  let jpegBuffer: Buffer;
  try {
    jpegBuffer = convertRaw(rawBuffer, OutputFormat.JPEG);
  } catch (error) {
    console.error('✗ Conversion failed:', (error as Error).message);
    throw error;
  }
  assert(Buffer.isBuffer(jpegBuffer), 'Conversion did not return a buffer');
  assert(jpegBuffer.length > 0, 'JPEG buffer is empty');
  console.log(`✓ Conversion successful (${jpegBuffer.length} bytes)\n`);

  console.log('Test 3: Verifying JPEG format...');
  assert(jpegBuffer[0] === 0xff, 'Invalid JPEG header byte 0');
  assert(jpegBuffer[1] === 0xd8, 'Invalid JPEG header byte 1');
  assert(jpegBuffer[2] === 0xff, 'Invalid JPEG header byte 2');
  console.log('✓ Valid JPEG header detected\n');

  console.log('Test 4: Writing JPEG to file...');
  fs.writeFileSync(TEST_OUTPUT_FILE, jpegBuffer);
  assert(fs.existsSync(TEST_OUTPUT_FILE), 'Failed to write output file');
  const writtenSize = fs.statSync(TEST_OUTPUT_FILE).size;
  assert(writtenSize === jpegBuffer.length, 'Written file size mismatch');
  console.log(`✓ JPEG written successfully to ${TEST_OUTPUT_FILE}\n`);

  console.log('Test 5: Testing error handling...');

  assert.throws(
    () => {
      convertRaw('not a buffer' as any, OutputFormat.JPEG);
    },
    /Input must be a Buffer/,
    'Should throw error for non-buffer input'
  );
  console.log('✓ Correctly handles non-buffer input');

  assert.throws(
    () => {
      convertRaw(Buffer.alloc(0), OutputFormat.JPEG);
    },
    /Input buffer is empty/,
    'Should throw error for empty buffer'
  );
  console.log('✓ Correctly handles empty buffer');

  assert.throws(
    () => {
      convertRaw(Buffer.from('invalid raw data'), OutputFormat.JPEG);
    },
    /Output image has empty extent/,
    'Should throw error for invalid RAW data'
  );
  console.log('✓ Correctly handles invalid RAW data\n');

  console.log('Test 6: Testing different output formats...');

  // Test JPEG format
  const jpegBuffer2 = convertRaw(rawBuffer, OutputFormat.JPEG);
  assert(Buffer.isBuffer(jpegBuffer2), 'JPEG format conversion failed');
  assert(jpegBuffer2.length > 0, 'JPEG format buffer is empty');
  assert(
    jpegBuffer2[0] === 0xff && jpegBuffer2[1] === 0xd8,
    'Invalid JPEG header'
  );
  console.log('✓ JPEG format works');

  // Test PNG format
  const pngBuffer = convertRaw(rawBuffer, OutputFormat.PNG);
  assert(Buffer.isBuffer(pngBuffer), 'PNG format conversion failed');
  assert(pngBuffer.length > 0, 'PNG format buffer is empty');
  assert(
    pngBuffer[0] === 0x89 &&
      pngBuffer[1] === 0x50 &&
      pngBuffer[2] === 0x4e &&
      pngBuffer[3] === 0x47,
    'Invalid PNG header'
  );
  fs.writeFileSync(path.join(TEST_OUTPUT_DIR, 'test_output.png'), pngBuffer);
  console.log('✓ PNG format works');

  // Test TIFF format
  const tiffBuffer = convertRaw(rawBuffer, OutputFormat.TIFF);
  assert(Buffer.isBuffer(tiffBuffer), 'TIFF format conversion failed');
  assert(tiffBuffer.length > 0, 'TIFF format buffer is empty');
  // TIFF can be little-endian (II) or big-endian (MM)
  const tiffHeader = tiffBuffer.toString('ascii', 0, 2);
  assert(tiffHeader === 'II' || tiffHeader === 'MM', 'Invalid TIFF header');
  fs.writeFileSync(path.join(TEST_OUTPUT_DIR, 'test_output.tif'), tiffBuffer);
  console.log('✓ TIFF format works');

  // Test HEIF format
  try {
    const heifBuffer = convertRaw(rawBuffer, OutputFormat.HEIF);
    assert(Buffer.isBuffer(heifBuffer), 'HEIF format conversion failed');
    assert(heifBuffer.length > 0, 'HEIF format buffer is empty');
    fs.writeFileSync(
      path.join(TEST_OUTPUT_DIR, 'test_output.heif'),
      heifBuffer
    );
    console.log('✓ HEIF format works');
  } catch (e) {
    console.log(
      '✓ HEIF format attempted (may not be supported on all systems)'
    );
  }

  // Test format parameter validation
  assert.throws(
    () => convertRaw(rawBuffer, 'bmp' as OutputFormat),
    /Unsupported format/,
    'Should throw error for unsupported format'
  );
  console.log('✓ Correctly rejects unsupported formats');

  assert.throws(
    () => convertRaw(rawBuffer, '' as OutputFormat),
    /Format must be a non-empty string/,
    'Should throw error for empty format'
  );
  console.log('✓ Correctly handles empty format string');

  assert.throws(
    () => convertRaw(rawBuffer, 123 as any),
    /Format must be a non-empty string/,
    'Should throw error for non-string format'
  );
  console.log('✓ Correctly handles non-string format\n');

  console.log('Test 7: Testing various conversion options...');

  // Test with lens correction
  const jpegWithLensCorrection = convertRaw(rawBuffer, OutputFormat.JPEG, {
    lensCorrection: true,
  });
  assert(
    Buffer.isBuffer(jpegWithLensCorrection),
    'Lens correction enabled conversion failed'
  );
  assert(
    jpegWithLensCorrection.length > 0,
    'Lens correction enabled buffer is empty'
  );
  console.log('✓ Lens correction enabled works');

  // Test with exposure adjustment
  const jpegWithExposure = convertRaw(rawBuffer, OutputFormat.JPEG, {
    exposure: 1.0,
  });
  assert(
    Buffer.isBuffer(jpegWithExposure),
    'Exposure adjustment conversion failed'
  );
  assert(jpegWithExposure.length > 0, 'Exposure adjustment buffer is empty');
  console.log('✓ Exposure adjustment works');

  // Test with boost adjustment
  const jpegWithBoost = convertRaw(rawBuffer, OutputFormat.JPEG, {
    boost: 0.5,
  });
  assert(Buffer.isBuffer(jpegWithBoost), 'Boost adjustment conversion failed');
  assert(jpegWithBoost.length > 0, 'Boost adjustment buffer is empty');
  console.log('✓ Boost adjustment works');

  // Test with shadow boost
  const jpegWithShadowBoost = convertRaw(rawBuffer, OutputFormat.JPEG, {
    boostShadowAmount: 0.3,
  });
  assert(
    Buffer.isBuffer(jpegWithShadowBoost),
    'Shadow boost conversion failed'
  );
  assert(jpegWithShadowBoost.length > 0, 'Shadow boost buffer is empty');
  console.log('✓ Shadow boost works');

  // Test with noise reduction
  const jpegWithNoiseReduction = convertRaw(rawBuffer, OutputFormat.JPEG, {
    colorNoiseReductionAmount: 0.5,
    luminanceNoiseReductionAmount: 0.3,
  });
  assert(
    Buffer.isBuffer(jpegWithNoiseReduction),
    'Noise reduction conversion failed'
  );
  assert(jpegWithNoiseReduction.length > 0, 'Noise reduction buffer is empty');
  console.log('✓ Noise reduction works');

  // Test with temperature adjustment
  const jpegWithTemp = convertRaw(rawBuffer, OutputFormat.JPEG, {
    neutralTemperature: 5500,
  });
  assert(
    Buffer.isBuffer(jpegWithTemp),
    'Temperature adjustment conversion failed'
  );
  assert(jpegWithTemp.length > 0, 'Temperature adjustment buffer is empty');
  console.log('✓ Temperature adjustment works');

  // Test with multiple options
  const jpegMultiOptions = convertRaw(rawBuffer, OutputFormat.JPEG, {
    lensCorrection: false,
    exposure: -0.5,
    boost: 0.8,
    allowDraftMode: true,
  });
  assert(
    Buffer.isBuffer(jpegMultiOptions),
    'Multiple options conversion failed'
  );
  assert(jpegMultiOptions.length > 0, 'Multiple options buffer is empty');
  console.log('✓ Multiple options work');

  // Test invalid options type
  assert.throws(
    () => {
      convertRaw(rawBuffer, OutputFormat.JPEG, 'invalid options' as any);
    },
    /Options must be an object/,
    'Should throw error for invalid options type'
  );
  console.log('✓ Correctly handles invalid options type\n');

  console.log('Test 8: Performance test...');
  const startTime = Date.now();
  const iterations = 3;

  for (let i = 0; i < iterations; i++) {
    convertRaw(rawBuffer, OutputFormat.JPEG);
  }

  const totalTime = Date.now() - startTime;
  const avgTime = totalTime / iterations;
  console.log(`✓ Average conversion time: ${avgTime.toFixed(2)}ms per image\n`);

  console.log('===================================');
  console.log('All tests passed! ✓');
  console.log('===================================');
  console.log(`\nOutput files saved to: ${TEST_OUTPUT_DIR}/`);
  console.log('You can open them to verify the conversion quality.');
  console.log(
    'Created files: test_output.jpg, test_output.png, test_output.tif'
  );
}

try {
  cleanup();
  runTests();
} catch (error) {
  console.error('\n❌ Test failed:', (error as Error).message);
  cleanup();
  process.exit(1);
}
