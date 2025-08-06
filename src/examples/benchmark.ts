import { convertRaw, convertRawAsync, OutputFormat } from '../index.js';
import { loadSampleImage } from './load-image.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let ITERATIONS = 5;

interface CliOptions {
  lensCorrection: boolean[];
  quality: number[];
  format: OutputFormat[];
  draftMode: boolean[];
  boost: number[];
  iterations?: number;
  mode: ('sync' | 'async')[];
  input: ('path' | 'buffer')[];
}

interface TestConfig {
  name: string;
  lensCorrection: boolean;
  allowDraftMode: boolean;
  quality?: number;
  boost?: number;
}

interface BenchmarkResult {
  format: string;
  config: string;
  mode: 'sync' | 'async';
  input: 'path' | 'buffer';
  avgTime: number;
  minTime: number;
  maxTime: number;
  outputSize: number;
}

function parseCliOptions(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    lensCorrection: [true, false],
    quality: [0.8],
    format: [
      OutputFormat.JPEG,
      OutputFormat.PNG,
      OutputFormat.TIFF,
      OutputFormat.JPEG2000,
      OutputFormat.HEIF,
    ],
    draftMode: [false],
    boost: [1.0],
    mode: ['sync', 'async'],
    input: ['buffer'],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case '--lens-correction':
        if (value) {
          options.lensCorrection = value
            .split(',')
            .map((v) => v.trim().toLowerCase() === 'true');
          i++;
        }
        break;
      case '--quality':
        if (value) {
          options.quality = value.split(',').map((v) => parseFloat(v.trim()));
          i++;
        }
        break;
      case '--format':
        if (value) {
          const formatMap: Record<string, OutputFormat> = {
            jpeg: OutputFormat.JPEG,
            jpg: OutputFormat.JPG,
            png: OutputFormat.PNG,
            tiff: OutputFormat.TIFF,
            tif: OutputFormat.TIF,
            jpeg2000: OutputFormat.JPEG2000,
            jp2: OutputFormat.JP2,
            heif: OutputFormat.HEIF,
            heic: OutputFormat.HEIC,
          };
          options.format = value.split(',').map((v) => {
            const format = formatMap[v.trim().toLowerCase()];
            if (!format) {
              throw new Error(`Unsupported format: ${v.trim()}`);
            }
            return format;
          });
          i++;
        }
        break;
      case '--draft-mode':
        if (value) {
          options.draftMode = value
            .split(',')
            .map((v) => v.trim().toLowerCase() === 'true');
          i++;
        }
        break;
      case '--boost':
        if (value) {
          options.boost = value.split(',').map((v) => parseFloat(v.trim()));
          i++;
        }
        break;
      case '--iterations':
        if (value) {
          options.iterations = parseInt(value.trim(), 10);
          i++;
        }
        break;
      case '--mode':
        if (value) {
          const modes = value.split(',').map((v) => v.trim().toLowerCase());
          const validModes: ('sync' | 'async')[] = [];
          for (const mode of modes) {
            if (mode === 'sync' || mode === 'async') {
              validModes.push(mode);
            } else {
              throw new Error(`Invalid mode: ${mode}. Use 'sync' or 'async'`);
            }
          }
          options.mode = validModes;
          i++;
        }
        break;
      case '--input':
        if (value) {
          const inputs = value.split(',').map((v) => v.trim().toLowerCase());
          const validInputs: ('path' | 'buffer')[] = [];
          for (const input of inputs) {
            if (input === 'path' || input === 'buffer') {
              validInputs.push(input);
            } else {
              throw new Error(`Invalid input: ${input}. Use 'path' or 'buffer'`);
            }
          }
          options.input = validInputs;
          i++;
        }
        break;
    }
  }

  return options;
}

function getFormatDisplayName(format: OutputFormat): string {
  const displayNames: Record<OutputFormat, string> = {
    [OutputFormat.JPEG]: 'JPEG',
    [OutputFormat.JPG]: 'JPEG',
    [OutputFormat.PNG]: 'PNG',
    [OutputFormat.TIFF]: 'TIFF',
    [OutputFormat.TIF]: 'TIFF',
    [OutputFormat.JPEG2000]: 'JPEG 2000',
    [OutputFormat.JP2]: 'JPEG 2000',
    [OutputFormat.HEIF]: 'HEIF',
    [OutputFormat.HEIC]: 'HEIF',
  };
  return displayNames[format];
}

function generateTestConfigs(cliOptions: CliOptions): TestConfig[] {
  const configs: TestConfig[] = [];

  for (const lensCorrection of cliOptions.lensCorrection) {
    for (const quality of cliOptions.quality) {
      for (const draftMode of cliOptions.draftMode) {
        for (const boost of cliOptions.boost) {
          const qualityStr = quality !== 0.8 ? ` Q${quality}` : '';
          const lensStr = lensCorrection ? ' +Lens' : ' -Lens';
          const boostStr = boost !== 1.0 ? ` B${boost}` : '';
          configs.push({
            name: `${draftMode ? 'Draft' : 'Standard'}${qualityStr}${boostStr}${lensStr}`,
            lensCorrection,
            allowDraftMode: draftMode,
            quality,
            boost,
          });
        }
      }
    }
  }

  return configs;
}

async function benchmark(): Promise<void> {
  const cliOptions = parseCliOptions();
  const testConfigs = generateTestConfigs(cliOptions);

  // Set iterations if specified
  if (cliOptions.iterations) {
    ITERATIONS = cliOptions.iterations;
  }

  console.log('Loading RAW image...');
  const rawBuffer = loadSampleImage();
  console.log(
    `RAW image size: ${(rawBuffer.length / 1024 / 1024).toFixed(2)} MB\n`
  );

  console.log('Benchmark configuration:');
  console.log(
    `  Formats: ${cliOptions.format.map(getFormatDisplayName).join(', ')}`
  );
  console.log(`  Lens correction: ${cliOptions.lensCorrection.join(', ')}`);
  console.log(`  Quality levels: ${cliOptions.quality.join(', ')}`);
  console.log(`  Draft mode: ${cliOptions.draftMode.join(', ')}`);
  console.log(`  Boost levels: ${cliOptions.boost.join(', ')}`);
  console.log(`  Mode: ${cliOptions.mode.join(', ')}`);
  console.log(`  Input: ${cliOptions.input.join(', ')}`);
  console.log(`  Iterations per test: ${ITERATIONS}`);
  console.log();

  // JIT warmup runs
  console.log('Warming up JIT...');
  const warmupFormat = cliOptions.format[0];
  const warmupConfig = testConfigs[0];

  for (let i = 0; i < 3; i++) {
    try {
      const conversionOptions: any = {
        lensCorrection: warmupConfig.lensCorrection,
        allowDraftMode: warmupConfig.allowDraftMode,
      };

      if (warmupConfig.boost !== undefined) {
        conversionOptions.boost = warmupConfig.boost;
      }

      if (
        warmupConfig.quality &&
        (warmupFormat === OutputFormat.JPEG ||
          warmupFormat === OutputFormat.JPG ||
          warmupFormat === OutputFormat.HEIF ||
          warmupFormat === OutputFormat.HEIC ||
          warmupFormat === OutputFormat.JPEG2000 ||
          warmupFormat === OutputFormat.JP2)
      ) {
        conversionOptions.quality = warmupConfig.quality;
      }

      convertRaw(rawBuffer, warmupFormat, conversionOptions);
    } catch (error) {
      console.warn(`Warmup run ${i + 1} failed: ${(error as Error).message}`);
    }
  }
  console.log('JIT warmup complete.\n');

  // Get the path to the sample image
  function findPackageRoot(startDir: string): string {
    let currentDir = startDir;
    while (currentDir !== path.dirname(currentDir)) {
      const packageJsonPath = path.join(currentDir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    throw new Error('package.json not found');
  }

  const currentFile = fileURLToPath(import.meta.url);
  const packageRoot = findPackageRoot(path.dirname(currentFile));
  const rawPath = path.join(packageRoot, 'data', 'DSC00053.ARW');

  const results: BenchmarkResult[] = [];

  for (const inputType of cliOptions.input) {
    for (const mode of cliOptions.mode) {
      for (const format of cliOptions.format) {
        const formatName = getFormatDisplayName(format);

        for (const config of testConfigs) {
          console.log(`Benchmarking ${formatName} - ${config.name} (${mode}, ${inputType})...`);

          const times: number[] = [];
          let outputSize = 0;

          for (let i = 0; i < ITERATIONS; i++) {
            const start = process.hrtime.bigint();

            try {
              const conversionOptions: any = {
                lensCorrection: config.lensCorrection,
                allowDraftMode: config.allowDraftMode,
              };

              if (config.boost !== undefined) {
                conversionOptions.boost = config.boost;
              }

              // Add quality option for formats that support it
              if (
                config.quality &&
                (format === OutputFormat.JPEG ||
                  format === OutputFormat.JPG ||
                  format === OutputFormat.HEIF ||
                  format === OutputFormat.HEIC ||
                  format === OutputFormat.JPEG2000 ||
                  format === OutputFormat.JP2)
              ) {
                conversionOptions.quality = config.quality;
              }

              // Use path or buffer based on input type
              const input = inputType === 'path' ? rawPath : rawBuffer;

              let result: Buffer;
              if (mode === 'async') {
                result = await convertRawAsync(
                  input,
                  format,
                  conversionOptions
                );
              } else {
                result = convertRaw(input, format, conversionOptions);
              }

              const end = process.hrtime.bigint();
              const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
              times.push(duration);

              // Record the output size from the last iteration
              if (i === ITERATIONS - 1) {
                outputSize = result.length;
              }
            } catch (error) {
              console.error(
                `  Error converting to ${formatName}: ${(error as Error).message}`
              );
              break;
            }
          }

          if (times.length === ITERATIONS) {
            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);

            results.push({
              format: formatName,
              config: config.name,
              mode,
              input: inputType,
              avgTime,
              minTime,
              maxTime,
              outputSize,
            });
          }
        }
      }
    }
  }

  // Print results table
  // Calculate dynamic column widths
  const formatWidth = Math.max(
    12,
    Math.max(...results.map((r) => r.format.length)) + 2
  );
  const configWidth = Math.max(
    15,
    Math.max(...results.map((r) => r.config.length)) + 2
  );
  const modeWidth = 8;
  const inputWidth = 10;
  const timeWidth = 15;
  const sizeWidth = 15;
  const totalWidth =
    formatWidth + configWidth + modeWidth + inputWidth + timeWidth * 3 + sizeWidth;

  console.log('\n' + '='.repeat(totalWidth));
  console.log('BENCHMARK RESULTS');
  console.log('='.repeat(totalWidth));

  // Header
  console.log(
    'Format'.padEnd(formatWidth) +
      'Configuration'.padEnd(configWidth) +
      'Mode'.padEnd(modeWidth) +
      'Input'.padEnd(inputWidth) +
      'Avg Time (ms)'.padEnd(timeWidth) +
      'Min Time (ms)'.padEnd(timeWidth) +
      'Max Time (ms)'.padEnd(timeWidth) +
      'Output Size'
  );
  console.log('-'.repeat(totalWidth));

  // Data rows
  for (const result of results) {
    console.log(
      result.format.padEnd(formatWidth) +
        result.config.padEnd(configWidth) +
        result.mode.padEnd(modeWidth) +
        result.input.padEnd(inputWidth) +
        result.avgTime.toFixed(2).padStart(timeWidth - 2) +
        result.minTime.toFixed(2).padStart(timeWidth) +
        result.maxTime.toFixed(2).padStart(timeWidth) +
        formatFileSize(result.outputSize).padStart(sizeWidth)
    );
  }

  console.log('='.repeat(totalWidth));

  // Print comparison if both modes were tested
  if (
    cliOptions.mode.length === 2 &&
    cliOptions.mode.includes('sync') &&
    cliOptions.mode.includes('async')
  ) {
    console.log('\n' + '='.repeat(totalWidth));
    console.log('SYNC vs ASYNC COMPARISON');
    console.log('='.repeat(totalWidth));

    const syncResults = results.filter((r) => r.mode === 'sync');
    const asyncResults = results.filter((r) => r.mode === 'async');

    console.log(
      'Format'.padEnd(formatWidth) +
        'Configuration'.padEnd(configWidth) +
        'Input'.padEnd(inputWidth) +
        'Sync (ms)'.padEnd(timeWidth) +
        'Async (ms)'.padEnd(timeWidth) +
        'Speedup'.padEnd(12)
    );
    console.log('-'.repeat(formatWidth + configWidth + inputWidth + timeWidth * 2 + 12));

    for (const syncResult of syncResults) {
      const asyncResult = asyncResults.find(
        (r) =>
          r.format === syncResult.format && 
          r.config === syncResult.config &&
          r.input === syncResult.input
      );

      if (asyncResult) {
        const speedup = syncResult.avgTime / asyncResult.avgTime;
        const speedupStr =
          speedup > 1
            ? `${speedup.toFixed(2)}x faster`
            : speedup < 1
            ? `${(1 / speedup).toFixed(2)}x slower`
            : 'Same';

        console.log(
          syncResult.format.padEnd(formatWidth) +
            syncResult.config.padEnd(configWidth) +
            syncResult.input.padEnd(inputWidth) +
            syncResult.avgTime.toFixed(2).padStart(timeWidth - 2) +
            asyncResult.avgTime.toFixed(2).padStart(timeWidth) +
            speedupStr.padStart(12)
        );
      }
    }

    console.log('='.repeat(formatWidth + configWidth + inputWidth + timeWidth * 2 + 12));
  }

  // Print path vs buffer comparison if both were tested
  if (
    cliOptions.input.length === 2 &&
    cliOptions.input.includes('path') &&
    cliOptions.input.includes('buffer')
  ) {
    console.log('\n' + '='.repeat(totalWidth));
    console.log('PATH vs BUFFER COMPARISON');
    console.log('='.repeat(totalWidth));

    const pathResults = results.filter((r) => r.input === 'path');
    const bufferResults = results.filter((r) => r.input === 'buffer');

    console.log(
      'Format'.padEnd(formatWidth) +
        'Configuration'.padEnd(configWidth) +
        'Mode'.padEnd(modeWidth) +
        'Path (ms)'.padEnd(timeWidth) +
        'Buffer (ms)'.padEnd(timeWidth) +
        'Speedup'.padEnd(12)
    );
    console.log('-'.repeat(formatWidth + configWidth + modeWidth + timeWidth * 2 + 12));

    for (const pathResult of pathResults) {
      const bufferResult = bufferResults.find(
        (r) =>
          r.format === pathResult.format && 
          r.config === pathResult.config &&
          r.mode === pathResult.mode
      );

      if (bufferResult) {
        const speedup = bufferResult.avgTime / pathResult.avgTime;
        const speedupStr =
          speedup > 1
            ? `Path ${speedup.toFixed(2)}x faster`
            : speedup < 1
            ? `Buffer ${(1 / speedup).toFixed(2)}x faster`
            : 'Same';

        console.log(
          pathResult.format.padEnd(formatWidth) +
            pathResult.config.padEnd(configWidth) +
            pathResult.mode.padEnd(modeWidth) +
            pathResult.avgTime.toFixed(2).padStart(timeWidth - 2) +
            bufferResult.avgTime.toFixed(2).padStart(timeWidth) +
            speedupStr.padStart(12)
        );
      }
    }

    console.log('='.repeat(formatWidth + configWidth + modeWidth + timeWidth * 2 + 12));
  }

  console.log(`\nIterations per format: ${ITERATIONS}`);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// Run the benchmark
benchmark().catch(console.error);
