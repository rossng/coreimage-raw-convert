#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { convertRaw, convertRawAsync, OutputFormat } from '../index.js';

async function demonstrateAsyncUsage() {
  console.log('🚀 Demonstrating convertRawAsync usage\n');

  const inputPath = path.join(process.cwd(), 'data', 'DSC00053.ARW');

  try {
    // Check if file exists
    await fs.access(inputPath);
  } catch {
    console.error(`❌ RAW file not found: ${inputPath}`);
    console.log('Please ensure you have a RAW file in the data/ directory');
    process.exit(1);
  }

  console.log(`Input file: ${inputPath}\n`);

  try {
    // Example 1: Basic async usage with file path (recommended)
    console.log('📁 Example 1: Using file path (most efficient)');
    const start1 = Date.now();
    const result1 = await convertRawAsync(inputPath, OutputFormat.JPEG, {
      quality: 0.9,
      lensCorrection: true,
      preserveExifData: true,
      scaleFactor: 0.5, // Half size for faster processing
    });
    const time1 = Date.now() - start1;
    console.log(
      `   ✓ Converted in ${time1}ms, output: ${result1.buffer.length} bytes\n`
    );

    // Example 2: Async usage with Buffer
    console.log('💾 Example 2: Using Buffer');
    const rawBuffer = await fs.readFile(inputPath);
    const start2 = Date.now();
    const result2 = await convertRawAsync(rawBuffer, OutputFormat.PNG, {
      lensCorrection: true,
      scaleFactor: 0.5,
    });
    const time2 = Date.now() - start2;
    console.log(
      `   ✓ Converted in ${time2}ms, output: ${result2.buffer.length} bytes\n`
    );

    // Example 3: Multiple concurrent conversions
    console.log('⚡ Example 3: Multiple concurrent conversions');
    const formats = [OutputFormat.JPEG, OutputFormat.PNG, OutputFormat.TIFF];
    const promises = formats.map(async (format, index) => {
      const start = Date.now();
      const result = await convertRawAsync(inputPath, format, {
        quality: 0.8,
        scaleFactor: 0.25, // Quarter size for speed
        lensCorrection: true,
      });
      const time = Date.now() - start;
      console.log(
        `   ✓ ${format.toUpperCase()}: ${result.buffer.length} bytes in ${time}ms`
      );
      return { format, result, time };
    });

    const concurrentStart = Date.now();
    const results = await Promise.all(promises);
    const concurrentTime = Date.now() - concurrentStart;
    console.log(`   🎯 Total concurrent time: ${concurrentTime}ms\n`);

    // Example 4: Error handling
    console.log('🚨 Example 4: Error handling');
    try {
      await convertRawAsync('/nonexistent/file.raw', OutputFormat.JPEG);
    } catch (error) {
      console.log(`   ✓ Caught expected error: ${(error as Error).message}\n`);
    }

    // Performance comparison
    console.log('📊 Performance comparison with sync version:');
    const syncStart = Date.now();
    const syncResult = convertRaw(rawBuffer, OutputFormat.JPEG, {
      quality: 0.9,
      lensCorrection: true,
      scaleFactor: 0.5,
    });
    const syncTime = Date.now() - syncStart;

    console.log(`   Sync:  ${syncTime}ms (blocks Node.js event loop)`);
    console.log(`   Async: ${time1}ms (non-blocking, file path)`);
    console.log(`   Async: ${time2}ms (non-blocking, buffer)`);

    console.log('\n🎉 Demo complete!');
    console.log('\n💡 Key benefits of convertRawAsync:');
    console.log('   • Non-blocking: Node.js event loop stays responsive');
    console.log('   • File path input: Most efficient (no buffer copying)');
    console.log(
      '   • Concurrent processing: Process multiple files simultaneously'
    );
    console.log('   • Same image quality and options as sync version');
  } catch (error) {
    console.error('❌ Demo failed:', (error as Error).message);
    process.exit(1);
  }
}

demonstrateAsyncUsage();
