#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { convertRaw, convertRawAsync, OutputFormat } from '../index.js';

const convertOptions = {
  lensCorrection: false,
  preserveExifData: true,
  quality: 0.85,
};

async function batchConvertRawsToJpeg(
  folderPath: string,
  useAsync: boolean = false,
  maxConcurrent: number = 3
) {
  try {
    const files = await fs.readdir(folderPath);

    const rawExtensions = [
      '.nef',
      '.cr2',
      '.arw',
      '.dng',
      '.raf',
      '.orf',
      '.raw',
    ];
    const rawFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return rawExtensions.includes(ext);
    });

    if (rawFiles.length === 0) {
      console.log('No RAW files found in the directory.');
      return;
    }

    const method = useAsync ? 'async' : 'sync';
    console.log(
      `Found ${rawFiles.length} RAW files to convert using ${method} method...`
    );
    if (useAsync) {
      console.log(`Max concurrent conversions: ${maxConcurrent}`);
    }

    const startTime = Date.now();

    if (useAsync) {
      // Async processing with concurrency control
      const semaphore = new Array(maxConcurrent).fill(0);
      let activeCount = 0;
      let completedCount = 0;

      const processFile = async (file: string): Promise<void> => {
        const inputPath = path.join(folderPath, file);
        const outputPath = path.join(
          folderPath,
          path.basename(file, path.extname(file)) + '.jpg'
        );

        try {
          console.log(`Converting ${file}... (async)`);

          // Use file path directly for better performance
          const jpegBuffer = await convertRawAsync(
            inputPath,
            OutputFormat.JPEG,
            convertOptions
          );

          await fs.writeFile(outputPath, jpegBuffer.buffer);
          console.log(`✓ Converted ${file} → ${path.basename(outputPath)}`);
        } catch (error) {
          console.error(
            `✗ Failed to convert ${file}:`,
            (error as Error).message
          );
        }
      };

      // Process files with concurrency control
      const promises: Promise<void>[] = [];

      for (const file of rawFiles) {
        // Wait for available slot
        while (activeCount >= maxConcurrent) {
          await Promise.race(promises.filter((p) => p));
        }

        activeCount++;
        const promise = processFile(file).finally(() => {
          activeCount--;
          completedCount++;
        });
        promises.push(promise);
      }

      // Wait for all conversions to complete
      await Promise.all(promises);
    } else {
      // Synchronous processing (original method)
      for (const file of rawFiles) {
        const inputPath = path.join(folderPath, file);
        const outputPath = path.join(
          folderPath,
          path.basename(file, path.extname(file)) + '.jpg'
        );

        try {
          console.log(`Converting ${file}... (sync)`);

          const rawBuffer = await fs.readFile(inputPath);

          const jpegBuffer = convertRaw(
            rawBuffer,
            OutputFormat.JPEG,
            convertOptions
          );

          await fs.writeFile(outputPath, jpegBuffer.buffer);
          console.log(`✓ Converted ${file} → ${path.basename(outputPath)}`);
        } catch (error) {
          console.error(
            `✗ Failed to convert ${file}:`,
            (error as Error).message
          );
        }
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(
      `Batch conversion complete! Total time: ${(totalTime / 1000).toFixed(2)}s`
    );
    console.log(
      `Average time per file: ${(totalTime / rawFiles.length / 1000).toFixed(2)}s`
    );
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

const folderPath = process.argv[2];
const useAsync = process.argv[3] === '--async';
const maxConcurrent = parseInt(process.argv[4]) || 3;

if (!folderPath) {
  console.error(
    'Usage: node batch-convert.js <folder-path> [--async] [max-concurrent]'
  );
  console.error('Examples:');
  console.error('  node batch-convert.js ./photos');
  console.error('  node batch-convert.js ./photos --async');
  console.error('  node batch-convert.js ./photos --async 5');
  process.exit(1);
}

batchConvertRawsToJpeg(folderPath, useAsync, maxConcurrent);
