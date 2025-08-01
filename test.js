import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { convertRawToJpeg } from './index.js';

const TEST_RAW_FILE = 'DSC00053.ARW';
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

  console.log('Test 7: Performance test...');
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
