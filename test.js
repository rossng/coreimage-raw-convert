import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { convertRawToJpeg } from './index.js';

const TEST_RAW_FILE = 'examples/DSC00053.ARW';
const TEST_OUTPUT_FILE = 'test-output/test_output.jpg';

function cleanup() {
  const testOutputDir = 'test-output';
  if (fs.existsSync(testOutputDir)) {
    const files = fs.readdirSync(testOutputDir);
    for (const file of files) {
      fs.unlinkSync(path.join(testOutputDir, file));
    }
    fs.rmdirSync(testOutputDir);
  }
}

function runTests() {
  console.log('Running CoreImage RAW Convert Tests...\n');

  const testOutputDir = path.dirname(TEST_OUTPUT_FILE);
  if (!fs.existsSync(testOutputDir)) {
    fs.mkdirSync(testOutputDir, { recursive: true });
  }

  console.log('Test 1: Checking test file exists...');
  assert(fs.existsSync(TEST_RAW_FILE), `Test file ${TEST_RAW_FILE} not found`);
  console.log('✓ Test file exists\n');

  console.log('Test 2: Reading RAW file...');
  const rawBuffer = fs.readFileSync(TEST_RAW_FILE);
  assert(Buffer.isBuffer(rawBuffer), 'Failed to read file as buffer');
  assert(rawBuffer.length > 0, 'RAW buffer is empty');
  console.log(`✓ RAW file read successfully (${rawBuffer.length} bytes)\n`);

  console.log('Test 3: Converting RAW to JPEG...');
  let jpegBuffer;
  try {
    jpegBuffer = convertRawToJpeg(rawBuffer);
  } catch (error) {
    console.error('✗ Conversion failed:', error.message);
    throw error;
  }
  assert(Buffer.isBuffer(jpegBuffer), 'Conversion did not return a buffer');
  assert(jpegBuffer.length > 0, 'JPEG buffer is empty');
  console.log(`✓ Conversion successful (${jpegBuffer.length} bytes)\n`);

  console.log('Test 4: Verifying JPEG format...');
  assert(jpegBuffer[0] === 0xff, 'Invalid JPEG header byte 0');
  assert(jpegBuffer[1] === 0xd8, 'Invalid JPEG header byte 1');
  assert(jpegBuffer[2] === 0xff, 'Invalid JPEG header byte 2');
  console.log('✓ Valid JPEG header detected\n');

  console.log('Test 5: Writing JPEG to file...');
  fs.writeFileSync(TEST_OUTPUT_FILE, jpegBuffer);
  assert(fs.existsSync(TEST_OUTPUT_FILE), 'Failed to write output file');
  const writtenSize = fs.statSync(TEST_OUTPUT_FILE).size;
  assert(writtenSize === jpegBuffer.length, 'Written file size mismatch');
  console.log(`✓ JPEG written successfully to ${TEST_OUTPUT_FILE}\n`);

  console.log('Test 6: Testing error handling...');

  assert.throws(
    () => {
      convertRawToJpeg('not a buffer');
    },
    /Input must be a Buffer/,
    'Should throw error for non-buffer input'
  );
  console.log('✓ Correctly handles non-buffer input');

  assert.throws(
    () => {
      convertRawToJpeg(Buffer.alloc(0));
    },
    /Input buffer is empty/,
    'Should throw error for empty buffer'
  );
  console.log('✓ Correctly handles empty buffer');

  assert.throws(
    () => {
      convertRawToJpeg(Buffer.from('invalid raw data'));
    },
    /Output image has empty extent/,
    'Should throw error for invalid RAW data'
  );
  console.log('✓ Correctly handles invalid RAW data\n');

  console.log('Test 7: Testing various conversion options...');

  // Test with lens correction
  const jpegWithLensCorrection = convertRawToJpeg(rawBuffer, {
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
  const jpegWithExposure = convertRawToJpeg(rawBuffer, { exposure: 1.0 });
  assert(
    Buffer.isBuffer(jpegWithExposure),
    'Exposure adjustment conversion failed'
  );
  assert(jpegWithExposure.length > 0, 'Exposure adjustment buffer is empty');
  console.log('✓ Exposure adjustment works');

  // Test with boost adjustment
  const jpegWithBoost = convertRawToJpeg(rawBuffer, { boost: 0.5 });
  assert(Buffer.isBuffer(jpegWithBoost), 'Boost adjustment conversion failed');
  assert(jpegWithBoost.length > 0, 'Boost adjustment buffer is empty');
  console.log('✓ Boost adjustment works');

  // Test with shadow boost
  const jpegWithShadowBoost = convertRawToJpeg(rawBuffer, {
    boostShadowAmount: 0.3,
  });
  assert(
    Buffer.isBuffer(jpegWithShadowBoost),
    'Shadow boost conversion failed'
  );
  assert(jpegWithShadowBoost.length > 0, 'Shadow boost buffer is empty');
  console.log('✓ Shadow boost works');

  // Test with noise reduction
  const jpegWithNoiseReduction = convertRawToJpeg(rawBuffer, {
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
  const jpegWithTemp = convertRawToJpeg(rawBuffer, {
    neutralTemperature: 5500,
  });
  assert(
    Buffer.isBuffer(jpegWithTemp),
    'Temperature adjustment conversion failed'
  );
  assert(jpegWithTemp.length > 0, 'Temperature adjustment buffer is empty');
  console.log('✓ Temperature adjustment works');

  // Test with multiple options
  const jpegMultiOptions = convertRawToJpeg(rawBuffer, {
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
      convertRawToJpeg(rawBuffer, 'invalid options');
    },
    /Options must be an object/,
    'Should throw error for invalid options type'
  );
  console.log('✓ Correctly handles invalid options type\n');

  console.log('Test 8: Performance test...');
  const startTime = Date.now();
  const iterations = 3;

  for (let i = 0; i < iterations; i++) {
    convertRawToJpeg(rawBuffer);
  }

  const totalTime = Date.now() - startTime;
  const avgTime = totalTime / iterations;
  console.log(`✓ Average conversion time: ${avgTime.toFixed(2)}ms per image\n`);

  console.log('===================================');
  console.log('All tests passed! ✓');
  console.log('===================================');
  console.log(`\nOutput JPEG saved to: ${TEST_OUTPUT_FILE}`);
  console.log('You can open it to verify the conversion quality.');
}

try {
  cleanup();
  runTests();
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  cleanup();
  process.exit(1);
}
