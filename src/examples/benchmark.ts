import { convertRaw, OutputFormat } from '../index.js';
import { loadSampleImage } from './load-image.js';

const ITERATIONS = 5;

interface CliOptions {
  lensCorrection: boolean[];
  quality: number[];
  format: OutputFormat[];
}

interface TestConfig {
  name: string;
  lensCorrection: boolean;
  allowDraftMode: boolean;
  quality?: number;
}

interface BenchmarkResult {
  format: string;
  config: string;
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
      const qualityStr = quality !== 0.8 ? ` Q${quality}` : '';
      const lensStr = lensCorrection ? ' +Lens' : ' -Lens';
      configs.push({
        name: `Standard${qualityStr}${lensStr}`,
        lensCorrection,
        allowDraftMode: false,
        quality,
      });
    }
  }

  return configs;
}

async function benchmark(): Promise<void> {
  const cliOptions = parseCliOptions();
  const testConfigs = generateTestConfigs(cliOptions);

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

  const results: BenchmarkResult[] = [];

  for (const format of cliOptions.format) {
    const formatName = getFormatDisplayName(format);

    for (const config of testConfigs) {
      console.log(`Benchmarking ${formatName} - ${config.name}...`);

      const times: number[] = [];
      let outputSize = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        const start = process.hrtime.bigint();

        try {
          const conversionOptions: any = {
            lensCorrection: config.lensCorrection,
            allowDraftMode: config.allowDraftMode,
          };

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

          const result = convertRaw(rawBuffer, format, conversionOptions);

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
          avgTime,
          minTime,
          maxTime,
          outputSize,
        });
      }
    }
  }

  // Print results table
  console.log('\n' + '='.repeat(100));
  console.log('BENCHMARK RESULTS');
  console.log('='.repeat(100));

  // Header
  console.log(
    'Format'.padEnd(12) +
      'Configuration'.padEnd(20) +
      'Avg Time (ms)'.padEnd(15) +
      'Min Time (ms)'.padEnd(15) +
      'Max Time (ms)'.padEnd(15) +
      'Output Size'
  );
  console.log('-'.repeat(100));

  // Data rows
  for (const result of results) {
    console.log(
      result.format.padEnd(12) +
        result.config.padEnd(20) +
        result.avgTime.toFixed(2).padStart(13) +
        result.minTime.toFixed(2).padStart(15) +
        result.maxTime.toFixed(2).padStart(15) +
        formatFileSize(result.outputSize).padStart(15)
    );
  }

  console.log('='.repeat(100));
  console.log(`\nIterations per format: ${ITERATIONS}`);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// Run the benchmark
benchmark().catch(console.error);
