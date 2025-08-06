import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSampleImage } from './examples/load-image.js';
import { convertRaw, convertRawAsync, OutputFormat, OutputImage } from './index.js';

const TEST_OUTPUT_DIR = 'test-output';

describe('CoreImage RAW Convert', () => {
  let rawBuffer: Buffer;
  let tempRawPath: string;

  beforeAll(async () => {
    // Create test output directory
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      const files = fs.readdirSync(TEST_OUTPUT_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(TEST_OUTPUT_DIR, file));
      }
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });

    // Load sample RAW image
    rawBuffer = loadSampleImage();
    expect(rawBuffer).toBeInstanceOf(Buffer);
    expect(rawBuffer.length).toBeGreaterThan(0);

    // Create temporary RAW file for file path tests
    tempRawPath = path.join(TEST_OUTPUT_DIR, 'temp_raw_file.arw');
    fs.writeFileSync(tempRawPath, rawBuffer);
  });

  afterAll(() => {
    // Clean up temp file
    if (fs.existsSync(tempRawPath)) {
      fs.unlinkSync(tempRawPath);
    }
  });

  describe('Synchronous Conversion (convertRaw)', () => {
    it('should load sample RAW file successfully', () => {
      expect(rawBuffer).toBeInstanceOf(Buffer);
      expect(rawBuffer.length).toBeGreaterThan(0);
      expect(rawBuffer.length).toBe(24996608);
    });

    it('should convert RAW to JPEG', () => {
      const jpegImage = convertRaw(rawBuffer, OutputFormat.JPEG);

      expect(jpegImage).toHaveProperty('buffer');
      expect(jpegImage.buffer).toBeInstanceOf(Buffer);
      expect(jpegImage.buffer.length).toBeGreaterThan(0);

      // Verify JPEG header
      expect(jpegImage.buffer[0]).toBe(0xff);
      expect(jpegImage.buffer[1]).toBe(0xd8);
      expect(jpegImage.buffer[2]).toBe(0xff);

      // Save and verify file
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test_output.jpg');
      fs.writeFileSync(outputPath, jpegImage.buffer);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.statSync(outputPath).size).toBe(jpegImage.buffer.length);
    });

    it('should handle error cases correctly', () => {
      // Invalid input type (neither buffer nor string)
      expect(() => {
        convertRaw(123 as any, OutputFormat.JPEG);
      }).toThrow('Input must be a Buffer or file path string');

      // Empty buffer
      expect(() => {
        convertRaw(Buffer.alloc(0), OutputFormat.JPEG);
      }).toThrow('Input buffer is empty');

      // Invalid RAW data
      expect(() => {
        convertRaw(Buffer.from('invalid raw data'), OutputFormat.JPEG);
      }).toThrow('Output image has empty extent');
    });

    it('should support different output formats', () => {
      // Test JPEG format
      const jpegImage = convertRaw(rawBuffer, OutputFormat.JPEG);
      expect(jpegImage).toHaveProperty('buffer');
      expect(jpegImage.buffer).toBeInstanceOf(Buffer);
      expect(jpegImage.buffer.length).toBeGreaterThan(0);
      expect(jpegImage.buffer[0]).toBe(0xff);
      expect(jpegImage.buffer[1]).toBe(0xd8);

      // Test PNG format
      const pngImage = convertRaw(rawBuffer, OutputFormat.PNG);
      expect(pngImage).toHaveProperty('buffer');
      expect(pngImage.buffer).toBeInstanceOf(Buffer);
      expect(pngImage.buffer.length).toBeGreaterThan(0);
      expect(pngImage.buffer[0]).toBe(0x89);
      expect(pngImage.buffer[1]).toBe(0x50);
      expect(pngImage.buffer[2]).toBe(0x4e);
      expect(pngImage.buffer[3]).toBe(0x47);
      fs.writeFileSync(
        path.join(TEST_OUTPUT_DIR, 'test_output.png'),
        pngImage.buffer
      );

      // Test TIFF format
      const tiffImage = convertRaw(rawBuffer, OutputFormat.TIFF);
      expect(tiffImage).toHaveProperty('buffer');
      expect(tiffImage.buffer).toBeInstanceOf(Buffer);
      expect(tiffImage.buffer.length).toBeGreaterThan(0);
      const tiffHeader = tiffImage.buffer.toString('ascii', 0, 2);
      expect(['II', 'MM']).toContain(tiffHeader);
      fs.writeFileSync(
        path.join(TEST_OUTPUT_DIR, 'test_output.tif'),
        tiffImage.buffer
      );

      // Test RGB format (raw bitmap data)
      const rgbImage = convertRaw(rawBuffer, OutputFormat.RGB);
      expect(rgbImage).toHaveProperty('buffer');
      expect(rgbImage.buffer).toBeInstanceOf(Buffer);
      expect(rgbImage.buffer.length).toBeGreaterThan(0);

      // RGB buffer should be exactly 6000x4000x3 = 72,000,000 bytes
      expect(rgbImage.buffer.length).toBe(72000000);
      const totalPixels = rgbImage.buffer.length / 3;
      expect(totalPixels).toBe(24000000); // 6000 * 4000

      // Test metadata (RGB format has default extractMetadata: false, so no metadata expected)
      expect(rgbImage.metadata).toBeUndefined();

      // Save RGB data to file
      fs.writeFileSync(
        path.join(TEST_OUTPUT_DIR, 'test_output.bin'),
        rgbImage.buffer
      );

      // Verify we have reasonable RGB values (0-255)
      for (let i = 0; i < Math.min(30, rgbImage.buffer.length); i++) {
        expect(rgbImage.buffer[i]).toBeGreaterThanOrEqual(0);
        expect(rgbImage.buffer[i]).toBeLessThanOrEqual(255);
      }

      // RGB should be significantly larger than compressed formats
      expect(rgbImage.buffer.length).toBeGreaterThan(jpegImage.buffer.length);
      expect(rgbImage.buffer.length).toBeGreaterThan(pngImage.buffer.length);

      // Test HEIF format (may not be supported on all systems)
      try {
        const heifImage = convertRaw(rawBuffer, OutputFormat.HEIF);
        expect(heifImage).toHaveProperty('buffer');
        expect(heifImage.buffer).toBeInstanceOf(Buffer);
        expect(heifImage.buffer.length).toBeGreaterThan(0);
        fs.writeFileSync(
          path.join(TEST_OUTPUT_DIR, 'test_output.heif'),
          heifImage.buffer
        );
      } catch (e) {
        // HEIF may not be supported on all systems, that's OK
      }
    });

    it('should reject invalid formats', () => {
      expect(() => convertRaw(rawBuffer, 'bmp' as OutputFormat)).toThrow(
        'Unsupported format'
      );
      expect(() => convertRaw(rawBuffer, '' as OutputFormat)).toThrow(
        'Format must be a non-empty string'
      );
      expect(() => convertRaw(rawBuffer, 123 as any)).toThrow(
        'Format must be a non-empty string'
      );
    });

    it('should support various conversion options', () => {
      // Lens correction
      const jpegWithLensCorrection = convertRaw(rawBuffer, OutputFormat.JPEG, {
        lensCorrection: true,
      });
      expect(jpegWithLensCorrection).toHaveProperty('buffer');
      expect(jpegWithLensCorrection.buffer).toBeInstanceOf(Buffer);
      expect(jpegWithLensCorrection.buffer.length).toBeGreaterThan(0);

      // Exposure adjustment
      const jpegWithExposure = convertRaw(rawBuffer, OutputFormat.JPEG, {
        exposure: 1.0,
      });
      expect(jpegWithExposure).toHaveProperty('buffer');
      expect(jpegWithExposure.buffer).toBeInstanceOf(Buffer);
      expect(jpegWithExposure.buffer.length).toBeGreaterThan(0);

      // Multiple options
      const jpegMultiOptions = convertRaw(rawBuffer, OutputFormat.JPEG, {
        lensCorrection: false,
        exposure: -0.5,
        boost: 0.8,
        allowDraftMode: true,
      });
      expect(jpegMultiOptions).toHaveProperty('buffer');
      expect(jpegMultiOptions.buffer).toBeInstanceOf(Buffer);
      expect(jpegMultiOptions.buffer.length).toBeGreaterThan(0);
    });

    it('should handle invalid options', () => {
      expect(() => {
        convertRaw(rawBuffer, OutputFormat.JPEG, 'invalid options' as any);
      }).toThrow('Options must be an object');
    });

    it('should preserve EXIF metadata by default', async () => {
      // With EXIF preservation (default)
      const jpegWithExif = convertRaw(rawBuffer, OutputFormat.JPEG, {
        quality: 0.9,
      });
      const exifPath = path.join(TEST_OUTPUT_DIR, 'test_with_exif.jpg');
      fs.writeFileSync(exifPath, jpegWithExif.buffer);

      const metadataWithExif = await sharp(exifPath).metadata();
      expect(metadataWithExif.exif).toBeDefined();

      // Without EXIF preservation
      const jpegWithoutExif = convertRaw(rawBuffer, OutputFormat.JPEG, {
        quality: 0.9,
        preserveExifData: false,
      });
      const noExifPath = path.join(TEST_OUTPUT_DIR, 'test_without_exif.jpg');
      fs.writeFileSync(noExifPath, jpegWithoutExif.buffer);

      const metadataWithoutExif = await sharp(noExifPath).metadata();
      expect(metadataWithoutExif.exif).toBeUndefined();
    });

    it('should convert RAW to JPEG using file path input', () => {
      const jpegImage = convertRaw(tempRawPath, OutputFormat.JPEG, {
        quality: 0.9,
        lensCorrection: true,
      });

      expect(jpegImage).toHaveProperty('buffer');
      expect(jpegImage.buffer).toBeInstanceOf(Buffer);
      expect(jpegImage.buffer.length).toBeGreaterThan(0);
      expect(jpegImage.buffer[0]).toBe(0xff);
      expect(jpegImage.buffer[1]).toBe(0xd8);

      fs.writeFileSync(
        path.join(TEST_OUTPUT_DIR, 'sync_path_test.jpg'),
        jpegImage.buffer
      );
    });

    it('should handle file path error cases', () => {
      // Non-existent file
      expect(() => {
        convertRaw('/nonexistent/file.arw', OutputFormat.JPEG);
      }).toThrow('Failed to read file from path');

      // Empty file path
      expect(() => {
        convertRaw('', OutputFormat.JPEG);
      }).toThrow('File path cannot be empty');

      // Invalid input type
      expect(() => {
        convertRaw(123 as any, OutputFormat.JPEG);
      }).toThrow('Input must be a Buffer or file path string');
    });

    it('should produce consistent results with Buffer and file path inputs', () => {
      const options = {
        quality: 0.85,
        lensCorrection: true,
        preserveExifData: false,
      };

      const bufferResult = convertRaw(rawBuffer, OutputFormat.JPEG, options);
      const pathResult = convertRaw(tempRawPath, OutputFormat.JPEG, options);

      // Results should be very close (within 100 bytes due to potential timing differences)
      expect(Math.abs(bufferResult.buffer.length - pathResult.buffer.length)).toBeLessThan(
        100
      );
    });
  });

  describe('Asynchronous Conversion (convertRawAsync)', () => {
    it('should convert RAW to JPEG using Buffer input', async () => {
      const jpegImage = await convertRawAsync(rawBuffer, OutputFormat.JPEG, {
        quality: 0.9,
        lensCorrection: true,
      });

      expect(jpegImage).toHaveProperty('buffer');
      expect(jpegImage.buffer).toBeInstanceOf(Buffer);
      expect(jpegImage.buffer.length).toBeGreaterThan(0);
      expect(jpegImage.buffer[0]).toBe(0xff);
      expect(jpegImage.buffer[1]).toBe(0xd8);

      fs.writeFileSync(
        path.join(TEST_OUTPUT_DIR, 'async_buffer_test.jpg'),
        jpegImage.buffer
      );
    });

    it('should convert RAW to JPEG using file path input', async () => {
      const jpegImage = await convertRawAsync(tempRawPath, OutputFormat.JPEG, {
        quality: 0.9,
        lensCorrection: true,
      });

      expect(jpegImage).toHaveProperty('buffer');
      expect(jpegImage.buffer).toBeInstanceOf(Buffer);
      expect(jpegImage.buffer.length).toBeGreaterThan(0);
      expect(jpegImage.buffer[0]).toBe(0xff);
      expect(jpegImage.buffer[1]).toBe(0xd8);

      fs.writeFileSync(
        path.join(TEST_OUTPUT_DIR, 'async_path_test.jpg'),
        jpegImage.buffer
      );
    });

    it('should handle async error cases', async () => {
      // Non-existent file
      await expect(
        convertRawAsync('/nonexistent/file.arw', OutputFormat.JPEG)
      ).rejects.toThrow('Failed to read file from path');

      // Empty buffer
      await expect(
        convertRawAsync(Buffer.alloc(0), OutputFormat.JPEG)
      ).rejects.toThrow('Input buffer is empty');

      // Invalid input type
      await expect(
        convertRawAsync(123 as any, OutputFormat.JPEG)
      ).rejects.toThrow('Input must be a Buffer or file path string');

      // Unsupported format
      await expect(
        convertRawAsync(rawBuffer, 'bmp' as OutputFormat)
      ).rejects.toThrow('Unsupported format');
    });

    it('should handle multiple concurrent conversions', async () => {
      const concurrentPromises = [
        convertRawAsync(rawBuffer, OutputFormat.JPEG, {
          quality: 0.8,
          scaleFactor: 0.5,
        }),
        convertRawAsync(tempRawPath, OutputFormat.PNG, { scaleFactor: 0.5 }),
        convertRawAsync(rawBuffer, OutputFormat.TIFF, { scaleFactor: 0.5 }),
      ];

      const [jpegResult, pngResult, tiffResult] =
        await Promise.all(concurrentPromises);

      // Verify JPEG
      expect(jpegResult).toHaveProperty('buffer');
      expect(jpegResult.buffer).toBeInstanceOf(Buffer);
      expect(jpegResult.buffer.length).toBeGreaterThan(0);
      expect(jpegResult.buffer[0]).toBe(0xff);
      expect(jpegResult.buffer[1]).toBe(0xd8);

      // Verify PNG
      expect(pngResult).toHaveProperty('buffer');
      expect(pngResult.buffer).toBeInstanceOf(Buffer);
      expect(pngResult.buffer.length).toBeGreaterThan(0);
      expect(pngResult.buffer[0]).toBe(0x89);
      expect(pngResult.buffer[1]).toBe(0x50);
      expect(pngResult.buffer[2]).toBe(0x4e);
      expect(pngResult.buffer[3]).toBe(0x47);

      // Verify TIFF
      expect(tiffResult).toHaveProperty('buffer');
      expect(tiffResult.buffer).toBeInstanceOf(Buffer);
      expect(tiffResult.buffer.length).toBeGreaterThan(0);
      const tiffHeader = tiffResult.buffer.toString('ascii', 0, 2);
      expect(['II', 'MM']).toContain(tiffHeader);

      // Save results
      fs.writeFileSync(
        path.join(TEST_OUTPUT_DIR, 'concurrent_test.jpg'),
        jpegResult.buffer
      );
      fs.writeFileSync(
        path.join(TEST_OUTPUT_DIR, 'concurrent_test.png'),
        pngResult.buffer
      );
      fs.writeFileSync(
        path.join(TEST_OUTPUT_DIR, 'concurrent_test.tif'),
        tiffResult.buffer
      );
    });

    it('should produce consistent results with sync version', async () => {
      const options = {
        quality: 0.85,
        lensCorrection: true,
        preserveExifData: false,
      };

      const syncResult = convertRaw(rawBuffer, OutputFormat.JPEG, options);
      const asyncResult = await convertRawAsync(
        rawBuffer,
        OutputFormat.JPEG,
        options
      );

      // Results should be very close (within 100 bytes due to potential timing differences)
      expect(Math.abs(syncResult.buffer.length - asyncResult.buffer.length)).toBeLessThan(
        100
      );
    });

    it('should handle large batches without issues', async () => {
      const batchSize = 5;
      const batchPromises = Array.from({ length: batchSize }, (_, i) =>
        convertRawAsync(rawBuffer, OutputFormat.JPEG, {
          quality: 0.7 + i * 0.05,
          scaleFactor: 0.3,
          lensCorrection: i % 2 === 0,
        })
      );

      const batchResults = await Promise.all(batchPromises);

      batchResults.forEach((result) => {
        expect(result).toHaveProperty('buffer');
        expect(result.buffer).toBeInstanceOf(Buffer);
        expect(result.buffer.length).toBeGreaterThan(0);
        expect(result.buffer[0]).toBe(0xff);
        expect(result.buffer[1]).toBe(0xd8);
      });
    });

    it('should keep main thread responsive during conversion', async () => {
      let tickCounter = 0;
      const tickInterval = setInterval(() => {
        tickCounter++;
      }, 50);

      let mainThreadWork = 0;
      const workInterval = setInterval(() => {
        for (let i = 0; i < 10000; i++) {
          mainThreadWork += Math.random();
        }
      }, 25);

      const startTime = Date.now();
      const result = await convertRawAsync(rawBuffer, OutputFormat.TIFF, {
        lensCorrection: true,
        scaleFactor: 1.0,
        preserveExifData: true,
        colorNoiseReductionAmount: 0.5,
        luminanceNoiseReductionAmount: 0.5,
      });
      const conversionTime = Date.now() - startTime;

      clearInterval(tickInterval);
      clearInterval(workInterval);

      // Verify conversion worked
      expect(result).toHaveProperty('buffer');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(0);

      // Verify main thread stayed responsive
      const expectedTicks = Math.floor(conversionTime / 50);
      const minExpectedTicks = Math.floor(expectedTicks * 0.5);
      const maxExpectedTicks = expectedTicks + 2;

      expect(tickCounter).toBeGreaterThan(0);
      expect(mainThreadWork).toBeGreaterThan(0);
      expect(tickCounter).toBeGreaterThanOrEqual(minExpectedTicks);
      expect(tickCounter).toBeLessThanOrEqual(maxExpectedTicks);

      fs.writeFileSync(
        path.join(TEST_OUTPUT_DIR, 'responsive_test.tif'),
        result.buffer
      );
    });

    it('should demonstrate blocking difference with sync version', async () => {
      // Test sync version (should block)
      let syncTickCounter = 0;
      const syncTickInterval = setInterval(() => {
        syncTickCounter++;
      }, 50);

      const syncStartTime = Date.now();
      const syncResult = convertRaw(rawBuffer, OutputFormat.TIFF, {
        lensCorrection: true,
        scaleFactor: 1.0,
        preserveExifData: true,
        colorNoiseReductionAmount: 0.5,
        luminanceNoiseReductionAmount: 0.5,
      });
      const syncTime = Date.now() - syncStartTime;

      clearInterval(syncTickInterval);

      // Verify sync version blocks the main thread
      const syncExpectedTicks = Math.floor(syncTime / 50);
      const maxAllowedSyncTicks = Math.max(
        1,
        Math.floor(syncExpectedTicks * 0.1)
      );

      expect(syncResult.buffer).toBeInstanceOf(Buffer);
      expect(syncResult.buffer.length).toBeGreaterThan(0);
      expect(syncTickCounter).toBeLessThanOrEqual(maxAllowedSyncTicks);
    });

    it('should convert RAW to RGB format asynchronously', async () => {
      const rgbImage = await convertRawAsync(rawBuffer, OutputFormat.RGB);

      expect(rgbImage).toHaveProperty('buffer');
      expect(rgbImage.buffer).toBeInstanceOf(Buffer);
      expect(rgbImage.buffer.length).toBeGreaterThan(0);

      // RGB buffer should be exactly 6000x4000x3 = 72,000,000 bytes
      expect(rgbImage.buffer.length).toBe(72000000);
      const totalPixels = rgbImage.buffer.length / 3;
      expect(totalPixels).toBe(24000000); // 6000 * 4000

      // Test metadata (RGB format has default extractMetadata: false, so no metadata expected)
      expect(rgbImage.metadata).toBeUndefined();

      // Save async RGB data to file (different name to avoid conflicts)
      fs.writeFileSync(
        path.join(TEST_OUTPUT_DIR, 'async_test_output.bin'),
        rgbImage.buffer
      );

      // Should produce consistent results with sync version
      const syncRgbImage = convertRaw(rawBuffer, OutputFormat.RGB);
      expect(rgbImage.buffer.length).toBe(syncRgbImage.buffer.length);

      // Buffers should be identical (raw data should be deterministic)
      expect(rgbImage.buffer.equals(syncRgbImage.buffer)).toBe(true);

      // Verify RGB values are in valid range
      for (let i = 0; i < Math.min(100, rgbImage.buffer.length); i++) {
        expect(rgbImage.buffer[i]).toBeGreaterThanOrEqual(0);
        expect(rgbImage.buffer[i]).toBeLessThanOrEqual(255);
      }
    });

    it('should extract metadata when extractMetadata option is enabled', async () => {
      // Test JPEG with metadata
      const jpegWithMetadata = await convertRawAsync(rawBuffer, OutputFormat.JPEG, {
        extractMetadata: true,
      });

      expect(jpegWithMetadata).toHaveProperty('buffer');
      expect(jpegWithMetadata).toHaveProperty('metadata');
      expect(jpegWithMetadata.metadata).toBeDefined();
      expect(jpegWithMetadata.metadata?.width).toBe(6000);
      expect(jpegWithMetadata.metadata?.height).toBe(4000);
      expect(jpegWithMetadata.metadata?.cameraMake).toBe('SONY');
      expect(jpegWithMetadata.metadata?.cameraModel).toBe('ZV-E10');
      expect(jpegWithMetadata.metadata?.focalLength35mm).toBe(22);
      expect(jpegWithMetadata.metadata?.fNumber).toBe(8);
      expect(jpegWithMetadata.metadata?.shutterSpeed).toBe(0.008);

      // Test JPEG without metadata (default)
      const jpegWithoutMetadata = await convertRawAsync(rawBuffer, OutputFormat.JPEG);
      expect(jpegWithoutMetadata).toHaveProperty('buffer');
      expect(jpegWithoutMetadata.metadata).toBeUndefined();

      // Test RGB with metadata
      const rgbWithMetadata = await convertRawAsync(rawBuffer, OutputFormat.RGB, {
        extractMetadata: true,
      });

      expect(rgbWithMetadata).toHaveProperty('buffer');
      expect(rgbWithMetadata).toHaveProperty('metadata');
      expect(rgbWithMetadata.metadata).toBeDefined();
      expect(rgbWithMetadata.metadata?.width).toBe(6000);
      expect(rgbWithMetadata.metadata?.height).toBe(4000);
    });
  });

  describe('Performance Tests', () => {
    it('should complete conversions within reasonable time', async () => {
      const iterations = 3;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        convertRaw(rawBuffer, OutputFormat.JPEG);
      }

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / iterations;

      expect(avgTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should show performance benefits with concurrent async operations', async () => {
      const batchSize = 3;

      // Sequential async (one at a time)
      const sequentialStart = Date.now();
      for (let i = 0; i < batchSize; i++) {
        await convertRawAsync(rawBuffer, OutputFormat.JPEG, {
          scaleFactor: 0.5,
        });
      }
      const sequentialTime = Date.now() - sequentialStart;

      // Concurrent async (all at once)
      const concurrentStart = Date.now();
      const concurrentPromises = Array.from({ length: batchSize }, () =>
        convertRawAsync(rawBuffer, OutputFormat.JPEG, { scaleFactor: 0.5 })
      );
      await Promise.all(concurrentPromises);
      const concurrentTime = Date.now() - concurrentStart;

      // Concurrent should be faster than sequential (though not necessarily by much due to CPU constraints)
      expect(concurrentTime).toBeLessThanOrEqual(sequentialTime);
    });
  });
});
