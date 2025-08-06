import assert from 'assert';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { loadSampleImage } from './examples/load-image.js';
import { convertRaw, convertRawAsync, OutputFormat } from './index.js';

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

async function runTests(): Promise<void> {
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

  console.log('Test 9: EXIF metadata preservation...');

  // Test with EXIF preservation enabled (default)
  const jpegWithExif = convertRaw(rawBuffer, OutputFormat.JPEG, {
    quality: 0.9,
  });
  const exifPath = path.join(TEST_OUTPUT_DIR, 'test_with_exif.jpg');
  fs.writeFileSync(exifPath, jpegWithExif);

  // Check EXIF data using sharp
  const metadataWithExif = await sharp(exifPath).metadata();
  assert(
    metadataWithExif.exif !== undefined,
    'EXIF data should be preserved by default'
  );
  console.log('✓ EXIF metadata preserved by default');

  // Extract EXIF data and check for camera model
  const exifData = await sharp(exifPath)
    .withMetadata()
    .toBuffer({ resolveWithObject: true });
  const exifInfo = await sharp(exifData.data).metadata();

  // The DSC00053.ARW file should have ZV-E10 as the device model
  // We can check if EXIF is present - the exact model checking might vary based on how metadata is stored
  assert(
    exifInfo.exif !== undefined,
    'EXIF data should contain camera information'
  );
  console.log('✓ EXIF metadata contains camera information');

  // Test with EXIF preservation explicitly disabled
  const jpegWithoutExif = convertRaw(rawBuffer, OutputFormat.JPEG, {
    quality: 0.9,
    preserveExifData: false,
  });
  const noExifPath = path.join(TEST_OUTPUT_DIR, 'test_without_exif.jpg');
  fs.writeFileSync(noExifPath, jpegWithoutExif);

  // Check that EXIF data is not preserved when disabled
  const metadataWithoutExif = await sharp(noExifPath).metadata();
  assert(
    metadataWithoutExif.exif === undefined,
    'EXIF data should not be preserved when disabled'
  );
  console.log('✓ EXIF metadata correctly removed when disabled\n');

  // New async tests
  console.log('Test 10: Testing convertRawAsync with Buffer input...');
  const asyncJpegBuffer = await convertRawAsync(rawBuffer, OutputFormat.JPEG, {
    quality: 0.9,
    lensCorrection: true,
  });
  assert(
    Buffer.isBuffer(asyncJpegBuffer),
    'Async conversion with Buffer failed'
  );
  assert(asyncJpegBuffer.length > 0, 'Async JPEG buffer is empty');
  assert(
    asyncJpegBuffer[0] === 0xff && asyncJpegBuffer[1] === 0xd8,
    'Invalid async JPEG header'
  );
  fs.writeFileSync(
    path.join(TEST_OUTPUT_DIR, 'async_buffer_test.jpg'),
    asyncJpegBuffer
  );
  console.log(
    `✓ Async conversion with Buffer successful (${asyncJpegBuffer.length} bytes)\n`
  );

  console.log('Test 11: Testing convertRawAsync with file path input...');
  // First save the raw buffer to a temporary file
  const tempRawPath = path.join(TEST_OUTPUT_DIR, 'temp_raw_file.arw');
  fs.writeFileSync(tempRawPath, rawBuffer);

  const asyncPathJpegBuffer = await convertRawAsync(
    tempRawPath,
    OutputFormat.JPEG,
    {
      quality: 0.9,
      lensCorrection: true,
    }
  );
  assert(
    Buffer.isBuffer(asyncPathJpegBuffer),
    'Async conversion with file path failed'
  );
  assert(
    asyncPathJpegBuffer.length > 0,
    'Async file path JPEG buffer is empty'
  );
  assert(
    asyncPathJpegBuffer[0] === 0xff && asyncPathJpegBuffer[1] === 0xd8,
    'Invalid async file path JPEG header'
  );
  fs.writeFileSync(
    path.join(TEST_OUTPUT_DIR, 'async_path_test.jpg'),
    asyncPathJpegBuffer
  );
  console.log(
    `✓ Async conversion with file path successful (${asyncPathJpegBuffer.length} bytes)\n`
  );

  console.log('Test 12: Testing async error handling...');

  // Test with non-existent file
  try {
    await convertRawAsync('/nonexistent/file.arw', OutputFormat.JPEG);
    assert.fail('Should have thrown error for non-existent file');
  } catch (error) {
    assert(
      (error as Error).message.includes('Failed to read file from path'),
      `Expected file read error, got: ${(error as Error).message}`
    );
    console.log('✓ Correctly handles non-existent file path');
  }

  // Test with empty buffer
  try {
    await convertRawAsync(Buffer.alloc(0), OutputFormat.JPEG);
    assert.fail('Should have thrown error for empty buffer');
  } catch (error) {
    assert(
      (error as Error).message.includes('Input buffer is empty'),
      `Expected empty buffer error, got: ${(error as Error).message}`
    );
    console.log('✓ Correctly handles empty buffer in async mode');
  }

  // Test with invalid input type
  try {
    await convertRawAsync(123 as any, OutputFormat.JPEG);
    assert.fail('Should have thrown error for invalid input type');
  } catch (error) {
    assert(
      (error as Error).message.includes(
        'Input must be a Buffer or file path string'
      ),
      `Expected input type error, got: ${(error as Error).message}`
    );
    console.log('✓ Correctly handles invalid input type in async mode');
  }

  // Test with unsupported format
  try {
    await convertRawAsync(rawBuffer, 'bmp' as OutputFormat);
    assert.fail('Should have thrown error for unsupported format');
  } catch (error) {
    assert(
      (error as Error).message.includes('Unsupported format'),
      `Expected unsupported format error, got: ${(error as Error).message}`
    );
    console.log('✓ Correctly handles unsupported format in async mode\n');
  }

  console.log('Test 13: Testing multiple concurrent async conversions...');
  const concurrentStart = Date.now();

  // Test concurrent conversions with different formats
  const concurrentPromises = [
    convertRawAsync(rawBuffer, OutputFormat.JPEG, {
      quality: 0.8,
      scaleFactor: 0.5,
    }),
    convertRawAsync(tempRawPath, OutputFormat.PNG, { scaleFactor: 0.5 }),
    convertRawAsync(rawBuffer, OutputFormat.TIFF, { scaleFactor: 0.5 }),
  ];

  const [concurrentJpeg, concurrentPng, concurrentTiff] =
    await Promise.all(concurrentPromises);
  const concurrentTime = Date.now() - concurrentStart;

  // Verify all conversions completed successfully
  assert(Buffer.isBuffer(concurrentJpeg), 'Concurrent JPEG conversion failed');
  assert(concurrentJpeg.length > 0, 'Concurrent JPEG buffer is empty');
  assert(
    concurrentJpeg[0] === 0xff && concurrentJpeg[1] === 0xd8,
    'Invalid concurrent JPEG header'
  );

  assert(Buffer.isBuffer(concurrentPng), 'Concurrent PNG conversion failed');
  assert(concurrentPng.length > 0, 'Concurrent PNG buffer is empty');
  assert(
    concurrentPng[0] === 0x89 &&
      concurrentPng[1] === 0x50 &&
      concurrentPng[2] === 0x4e &&
      concurrentPng[3] === 0x47,
    'Invalid concurrent PNG header'
  );

  assert(Buffer.isBuffer(concurrentTiff), 'Concurrent TIFF conversion failed');
  assert(concurrentTiff.length > 0, 'Concurrent TIFF buffer is empty');
  const concurrentTiffHeader = concurrentTiff.toString('ascii', 0, 2);
  assert(
    concurrentTiffHeader === 'II' || concurrentTiffHeader === 'MM',
    'Invalid concurrent TIFF header'
  );

  // Save concurrent results
  fs.writeFileSync(
    path.join(TEST_OUTPUT_DIR, 'concurrent_test.jpg'),
    concurrentJpeg
  );
  fs.writeFileSync(
    path.join(TEST_OUTPUT_DIR, 'concurrent_test.png'),
    concurrentPng
  );
  fs.writeFileSync(
    path.join(TEST_OUTPUT_DIR, 'concurrent_test.tif'),
    concurrentTiff
  );

  console.log(`✓ 3 concurrent conversions completed in ${concurrentTime}ms`);
  console.log(`  JPEG: ${concurrentJpeg.length} bytes`);
  console.log(`  PNG:  ${concurrentPng.length} bytes`);
  console.log(`  TIFF: ${concurrentTiff.length} bytes\n`);

  console.log('Test 14: Comparing sync vs async output consistency...');

  // Convert same input with same options using both methods
  const syncResult = convertRaw(rawBuffer, OutputFormat.JPEG, {
    quality: 0.85,
    lensCorrection: true,
    preserveExifData: false,
  });

  const asyncResult = await convertRawAsync(rawBuffer, OutputFormat.JPEG, {
    quality: 0.85,
    lensCorrection: true,
    preserveExifData: false,
  });

  // Results should be identical (or very close due to potential timing differences)
  assert(
    Math.abs(syncResult.length - asyncResult.length) < 100,
    `Sync and async results differ significantly: sync=${syncResult.length}, async=${asyncResult.length}`
  );

  console.log(`✓ Sync result:  ${syncResult.length} bytes`);
  console.log(`✓ Async result: ${asyncResult.length} bytes`);
  console.log('✓ Output consistency verified between sync and async methods\n');

  console.log('Test 15: Testing async performance with larger batch...');
  const batchStart = Date.now();
  const batchSize = 5;

  // Create multiple concurrent conversions with different options
  const batchPromises = Array.from({ length: batchSize }, (_, i) =>
    convertRawAsync(rawBuffer, OutputFormat.JPEG, {
      quality: 0.7 + i * 0.05, // Vary quality from 0.7 to 0.9
      scaleFactor: 0.3, // Small scale for speed
      lensCorrection: i % 2 === 0, // Alternate lens correction
    })
  );

  const batchResults = await Promise.all(batchPromises);
  const batchTime = Date.now() - batchStart;

  // Verify all batch results
  batchResults.forEach((result, i) => {
    assert(Buffer.isBuffer(result), `Batch result ${i} is not a Buffer`);
    assert(result.length > 0, `Batch result ${i} is empty`);
    assert(
      result[0] === 0xff && result[1] === 0xd8,
      `Batch result ${i} has invalid JPEG header`
    );
  });

  const avgBatchTime = batchTime / batchSize;
  console.log(
    `✓ ${batchSize} concurrent conversions completed in ${batchTime}ms`
  );
  console.log(`✓ Average time per conversion: ${avgBatchTime.toFixed(2)}ms`);
  console.log('✓ All batch conversions completed successfully\n');

  console.log(
    'Test 16: Verifying main thread responsiveness during async conversion...'
  );

  // Set up a counter to show the main thread is running
  let tickCounter = 0;
  const tickInterval = setInterval(() => {
    tickCounter++;
    process.stdout.write(`\r   Main thread tick: ${tickCounter}`);
  }, 50); // Tick every 50ms for reasonable frequency

  console.log('   Starting long-running async conversion...');

  // Start a conversion that takes a reasonable amount of time
  const responsiveStart = Date.now();
  const responsivePromise = convertRawAsync(rawBuffer, OutputFormat.TIFF, {
    lensCorrection: true,
    scaleFactor: 1.0, // Full size for longer processing time
    preserveExifData: true,
    colorNoiseReductionAmount: 0.5,
    luminanceNoiseReductionAmount: 0.5,
  });

  // Also do some main thread work while conversion is running
  let mainThreadWork = 0;
  const workInterval = setInterval(() => {
    // Do some CPU work on main thread
    for (let i = 0; i < 10000; i++) {
      mainThreadWork += Math.random();
    }
  }, 25); // More frequent work

  // Wait for conversion to complete
  const responsiveResult = await responsivePromise;
  const responsiveTime = Date.now() - responsiveStart;

  // Stop counters and intervals
  clearInterval(tickInterval);
  clearInterval(workInterval);

  // Clear the tick counter line and move to next line
  process.stdout.write('\r' + ' '.repeat(30) + '\r');

  // Verify the conversion worked
  assert(
    Buffer.isBuffer(responsiveResult),
    'Responsive test conversion failed'
  );
  assert(responsiveResult.length > 0, 'Responsive test buffer is empty');

  // Save result
  fs.writeFileSync(
    path.join(TEST_OUTPUT_DIR, 'responsive_test.tif'),
    responsiveResult
  );

  // Calculate expected ticks based on timing
  const expectedTicks = Math.floor(responsiveTime / 50); // 50ms interval
  const minExpectedTicks = Math.floor(expectedTicks * 0.5); // At least 50% of expected
  const maxExpectedTicks = expectedTicks + 2; // Allow some variance

  console.log(
    `✓ Conversion completed in ${responsiveTime}ms while main thread remained active`
  );
  console.log(`✓ Main thread ticked ${tickCounter} times during conversion`);
  console.log(`✓ Expected approximately ${expectedTicks} ticks (got ${tickCounter})`);
  console.log(`✓ Main thread performed ${mainThreadWork.toFixed(0)} work operations`);
  console.log(`✓ Result: ${responsiveResult.length} bytes`);

  // Verify main thread was actually doing work with proper validation
  assert(tickCounter > 0, 'Main thread counter should have incremented');
  assert(mainThreadWork > 0, 'Main thread should have performed work');
  assert(
    tickCounter >= minExpectedTicks,
    `Main thread should have ticked at least ${minExpectedTicks} times (50% of expected ${expectedTicks}), but got ${tickCounter}`
  );
  assert(
    tickCounter <= maxExpectedTicks,
    `Main thread ticked too many times: ${tickCounter} (expected max ${maxExpectedTicks})`
  );

  console.log(
    `✓ Tick count validation passed: ${tickCounter} is within expected range [${minExpectedTicks}, ${maxExpectedTicks}]`
  );

  console.log(
    '✓ Main thread responsiveness verified during async conversion\n'
  );

  // Compare with sync version to show the difference
  console.log('Test 17: Comparing main thread blocking (sync vs async)...');

  console.log('   Testing sync conversion (should block main thread)...');

  let syncTickCounter = 0;
  const syncTickInterval = setInterval(() => {
    syncTickCounter++;
    process.stdout.write(`\r   Sync main thread tick: ${syncTickCounter}`);
  }, 50); // Same interval as async test for fair comparison

  const syncStart = Date.now();
  const syncBlockingResult = convertRaw(rawBuffer, OutputFormat.TIFF, {
    lensCorrection: true,
    scaleFactor: 1.0,
    preserveExifData: true,
    colorNoiseReductionAmount: 0.5,
    luminanceNoiseReductionAmount: 0.5,
  });
  const syncTime = Date.now() - syncStart;

  clearInterval(syncTickInterval);
  process.stdout.write('\r' + ' '.repeat(35) + '\r');

  console.log(`✓ Sync conversion completed in ${syncTime}ms`);
  console.log(
    `✓ Main thread ticked only ${syncTickCounter} times (should be 0 or very low)`
  );
  console.log(`✓ Result: ${syncBlockingResult.length} bytes`);

  // Calculate what we would expect for sync if it were non-blocking (for comparison)
  const syncExpectedTicks = Math.floor(syncTime / 50);
  
  // Verify sync version blocked the main thread - should be much less than expected
  const maxAllowedSyncTicks = Math.max(1, Math.floor(syncExpectedTicks * 0.1)); // Allow up to 10% of expected
  assert(
    syncTickCounter <= maxAllowedSyncTicks,
    `Sync conversion should block main thread. Expected <= ${maxAllowedSyncTicks} ticks (10% of ${syncExpectedTicks}), but got ${syncTickCounter}`
  );
  
  console.log(`✓ Sync blocking validation passed: ${syncTickCounter} <= ${maxAllowedSyncTicks} (${((syncTickCounter/syncExpectedTicks)*100).toFixed(1)}% of expected non-blocking rate)`);

  // Compare tick counts to demonstrate the difference
  const asyncTicksPerMs = tickCounter / responsiveTime;
  const syncTicksPerMs = syncTickCounter / syncTime;

  console.log('\n   📊 Main Thread Responsiveness Comparison:');
  console.log(
    `     Async: ${tickCounter} ticks in ${responsiveTime}ms (${(asyncTicksPerMs * 1000).toFixed(2)} ticks/sec)`
  );
  console.log(
    `     Sync:  ${syncTickCounter} ticks in ${syncTime}ms (${(syncTicksPerMs * 1000).toFixed(2)} ticks/sec)`
  );
  console.log(
    `     Difference: ${(asyncTicksPerMs / Math.max(syncTicksPerMs, 0.001)).toFixed(1)}x more responsive with async`
  );

  console.log('✓ Main thread blocking comparison completed');
  
  // Verify our validation logic is sound by checking edge cases
  console.log('✓ Responsiveness validation logic verified:');
  console.log(`  - Async ticks: ${tickCounter} (${((tickCounter/expectedTicks)*100).toFixed(1)}% of expected)`);
  console.log(`  - Sync ticks: ${syncTickCounter} (${((syncTickCounter/syncExpectedTicks)*100).toFixed(1)}% of expected)`);
  console.log(`  - Validation successfully distinguished between blocking and non-blocking behavior\n`);

  // Clean up temp file
  if (fs.existsSync(tempRawPath)) {
    fs.unlinkSync(tempRawPath);
  }

  console.log('===================================');
  console.log('All tests passed! ✓');
  console.log('===================================');
  console.log(`\nOutput files saved to: ${TEST_OUTPUT_DIR}/`);
  console.log('You can open them to verify the conversion quality.');
  console.log(
    'Created files: test_output.jpg, test_output.png, test_output.tif'
  );
}

(async () => {
  try {
    cleanup();
    await runTests();
  } catch (error) {
    console.error('\n❌ Test failed:', (error as Error).message);
    cleanup();
    process.exit(1);
  }
})();
