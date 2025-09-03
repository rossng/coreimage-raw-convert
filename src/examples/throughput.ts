#!/usr/bin/env node
import PQueue from 'p-queue';
import { convertRaw, convertRawAsync, OutputFormat } from '../index.js';
import { loadSampleImage } from './load-image.js';

interface ThroughputOptions {
  conversions: number;
  concurrency: number;
}

function parseCliOptions(): ThroughputOptions {
  const args = process.argv.slice(2);
  let conversions = 100;
  let concurrency = 4;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case '--conversions':
      case '-c':
        if (value) {
          conversions = parseInt(value.trim(), 10);
          i++;
        }
        break;
      case '--concurrency':
      case '-j':
        if (value) {
          concurrency = parseInt(value.trim(), 10);
          i++;
        }
        break;
      case '--help':
      case '-h':
        console.log('Usage: throughput.ts [options]');
        console.log('Options:');
        console.log(
          '  --conversions, -c <num>  Number of conversions to perform (default: 100)'
        );
        console.log(
          '  --concurrency, -j <num>  Concurrency level for async test (default: 4)'
        );
        console.log('  --help, -h               Show this help');
        process.exit(0);
        break;
    }
  }

  return { conversions, concurrency };
}

async function runSequentialTest(
  buffer: Buffer,
  conversions: number
): Promise<{ totalTime: number; avgTime: number; throughput: number }> {
  console.log(`  Running ${conversions} sequential conversions...`);

  const format = OutputFormat.JPEG;
  const options = { quality: 0.8, lensCorrection: true, scaleFactor: 0.5 };

  const start = process.hrtime.bigint();

  for (let i = 0; i < conversions; i++) {
    if (i % Math.max(1, Math.floor(conversions / 10)) === 0) {
      process.stdout.write(`.`);
    }
    convertRaw(buffer, format, options);
  }

  const end = process.hrtime.bigint();
  const totalTime = Number(end - start) / 1_000_000; // Convert to milliseconds
  const avgTime = totalTime / conversions;
  const throughput = conversions / (totalTime / 1000); // conversions per second

  console.log('');
  return { totalTime, avgTime, throughput };
}

async function runConcurrentTest(
  buffer: Buffer,
  conversions: number,
  concurrency: number
): Promise<{ totalTime: number; avgTime: number; throughput: number }> {
  console.log(
    `  Running ${conversions} concurrent conversions (concurrency: ${concurrency})...`
  );

  const format = OutputFormat.JPEG;
  const options = { quality: 0.8, lensCorrection: true, scaleFactor: 0.5 };

  const queue = new PQueue({ concurrency });
  let completed = 0;

  const start = process.hrtime.bigint();

  const tasks = Array.from({ length: conversions }, () =>
    queue.add(async () => {
      const result = await convertRawAsync(buffer, format, options);
      completed++;
      if (completed % Math.max(1, Math.floor(conversions / 10)) === 0) {
        process.stdout.write(`.`);
      }
      return result;
    })
  );

  await Promise.all(tasks);

  const end = process.hrtime.bigint();
  const totalTime = Number(end - start) / 1_000_000; // Convert to milliseconds
  const avgTime = totalTime / conversions;
  const throughput = conversions / (totalTime / 1000); // conversions per second

  console.log('');
  return { totalTime, avgTime, throughput };
}

async function runThroughputBenchmark(): Promise<void> {
  const options = parseCliOptions();

  console.log('🚀 RAW Conversion Throughput Benchmark\n');
  console.log(`Configuration:`);
  console.log(`  Conversions: ${options.conversions}`);
  console.log(`  Concurrency: ${options.concurrency}`);
  console.log(`  Format: JPEG (quality: 0.8, lens correction: on, scale: 0.5)`);
  console.log('');

  console.log('Loading RAW image...');
  const rawBuffer = loadSampleImage();
  console.log(
    `RAW image size: ${(rawBuffer.length / 1024 / 1024).toFixed(2)} MB\n`
  );

  // JIT warmup
  console.log('Warming up JIT...');
  for (let i = 0; i < 3; i++) {
    convertRaw(rawBuffer, OutputFormat.JPEG, {
      scaleFactor: 0.25,
      inputFormat: 'arw',
    });
    await convertRawAsync(rawBuffer, OutputFormat.JPEG, {
      scaleFactor: 0.25,
      inputFormat: 'arw',
    });
  }
  console.log('JIT warmup complete.\n');

  // Sequential test
  console.log('📊 Sequential Processing');
  const sequentialResult = await runSequentialTest(
    rawBuffer,
    options.conversions
  );
  console.log(
    `  Total: ${sequentialResult.totalTime.toFixed(0)}ms, Avg: ${sequentialResult.avgTime.toFixed(2)}ms, Throughput: ${sequentialResult.throughput.toFixed(2)} conv/s\n`
  );

  // Concurrent test
  console.log('📊 Concurrent Processing');
  const concurrentResult = await runConcurrentTest(
    rawBuffer,
    options.conversions,
    options.concurrency
  );
  console.log(
    `  Total: ${concurrentResult.totalTime.toFixed(0)}ms, Avg: ${concurrentResult.avgTime.toFixed(2)}ms, Throughput: ${concurrentResult.throughput.toFixed(2)} conv/s\n`
  );

  const speedup = sequentialResult.totalTime / concurrentResult.totalTime;

  // Summary
  console.log('='.repeat(80));
  console.log('THROUGHPUT BENCHMARK RESULTS');
  console.log('='.repeat(80));
  console.log('Mode          Total Time    Avg Time     Throughput   ');
  console.log('-'.repeat(80));
  console.log(
    `Sequential    ${sequentialResult.totalTime.toFixed(0).padStart(8)}ms    ${sequentialResult.avgTime.toFixed(2).padStart(7)}ms    ${sequentialResult.throughput.toFixed(2).padStart(7)} c/s`
  );
  console.log(
    `Concurrent    ${concurrentResult.totalTime.toFixed(0).padStart(8)}ms    ${concurrentResult.avgTime.toFixed(2).padStart(7)}ms    ${concurrentResult.throughput.toFixed(2).padStart(7)} c/s`
  );
  console.log('='.repeat(80));
  console.log(
    `Speedup: ${speedup.toFixed(2)}x faster with concurrency ${options.concurrency}`
  );
  console.log(
    `Total conversions: ${options.conversions * 2} (${options.conversions} sequential + ${options.conversions} concurrent)`
  );
  console.log(
    `Best throughput: ${Math.max(sequentialResult.throughput, concurrentResult.throughput).toFixed(2)} conversions/second`
  );
  console.log('');
}

runThroughputBenchmark().catch(console.error);
