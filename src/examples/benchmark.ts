import { convertRaw, OutputFormat } from '../index.js';
import { loadSampleImage } from './load-image.js';

const ITERATIONS = 5;

interface FormatConfig {
  name: string;
  ext: OutputFormat;
}

interface TestConfig {
  name: string;
  lensCorrection: boolean;
  allowDraftMode: boolean;
}

interface BenchmarkResult {
  format: string;
  config: string;
  avgTime: number;
  minTime: number;
  maxTime: number;
  outputSize: number;
}

const formats: FormatConfig[] = [
  { name: 'JPEG', ext: OutputFormat.JPEG },
  { name: 'PNG', ext: OutputFormat.PNG },
  { name: 'TIFF', ext: OutputFormat.TIFF },
  { name: 'JPEG 2000', ext: OutputFormat.JPEG2000 },
  { name: 'HEIF', ext: OutputFormat.HEIF },
];

const testConfigs: TestConfig[] = [
  { name: 'Standard + Lens', lensCorrection: true, allowDraftMode: false },
  { name: 'Standard - Lens', lensCorrection: false, allowDraftMode: false },
  { name: 'Draft + Lens', lensCorrection: true, allowDraftMode: true },
  { name: 'Draft - Lens', lensCorrection: false, allowDraftMode: true },
];

async function benchmark(): Promise<void> {
  console.log('Loading RAW image...');
  const rawBuffer = loadSampleImage();
  console.log(
    `RAW image size: ${(rawBuffer.length / 1024 / 1024).toFixed(2)} MB\n`
  );

  const results: BenchmarkResult[] = [];

  for (const format of formats) {
    for (const config of testConfigs) {
      console.log(`Benchmarking ${format.name} - ${config.name}...`);

      const times: number[] = [];
      let outputSize = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        const start = process.hrtime.bigint();

        try {
          const result = convertRaw(rawBuffer, format.ext, {
            lensCorrection: config.lensCorrection,
            allowDraftMode: config.allowDraftMode,
          });

          const end = process.hrtime.bigint();
          const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
          times.push(duration);

          // Record the output size from the last iteration
          if (i === ITERATIONS - 1) {
            outputSize = result.length;
          }
        } catch (error) {
          console.error(
            `  Error converting to ${format.name}: ${(error as Error).message}`
          );
          break;
        }
      }

      if (times.length === ITERATIONS) {
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);

        results.push({
          format: format.name,
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
