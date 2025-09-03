import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadArwImage, loadDngImage } from './examples/load-image.js';
import { convertRaw, convertRawAsync, OutputFormat } from './index.js';

const TEST_OUTPUT_DIR = 'test-output';

// Test parameters for different RAW formats
const formatTestCases = [
  {
    formatName: 'ARW',
    inputFormat: 'arw' as const,
    loadImage: loadArwImage,
    expectedSize: 24996608,
    fileExtension: '.arw',
    dimensions: {
      width: 6000,
      height: 4000,
      pixels: 24000000,
      rgbBytes: 72000000, // width * height * 3
    },
    metadata: {
      cameraMake: 'SONY',
      cameraModel: 'ZV-E10',
      focalLength35mm: 22,
      fNumber: 8,
      shutterSpeed: 0.008,
    },
  },
  {
    formatName: 'DNG',
    inputFormat: 'dng' as const,
    loadImage: loadDngImage,
    expectedSize: 21963264,
    fileExtension: '.dng',
    dimensions: {
      width: 5272,
      height: 2962,
      pixels: 15615664,
      rgbBytes: 46846992, // width * height * 3
    },
    metadata: {
      cameraMake: 'Hasselblad',
      cameraModel: 'L2D-20c',
      focalLength35mm: 24,
      fNumber: 8,
      shutterSpeed: 1 / 60,
    },
  },
];

describe('CoreImage RAW Convert', () => {
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
  });

  afterAll(() => {
    // Cleanup will be handled by individual test suites
  });

  describe.each(formatTestCases)(
    '$formatName Format - Synchronous Conversion (convertRaw)',
    ({
      formatName,
      inputFormat,
      loadImage,
      expectedSize,
      fileExtension,
      dimensions,
      metadata,
    }) => {
      let rawBuffer: Buffer;
      let tempRawPath: string;

      beforeAll(() => {
        rawBuffer = loadImage();
        expect(rawBuffer).toBeInstanceOf(Buffer);
        expect(rawBuffer.length).toBeGreaterThan(0);
        expect(rawBuffer.length).toBe(expectedSize);

        // Create temporary RAW file for file path tests
        tempRawPath = path.join(
          TEST_OUTPUT_DIR,
          `temp_raw_file${fileExtension}`
        );
        fs.writeFileSync(tempRawPath, rawBuffer);
      });

      afterAll(() => {
        if (fs.existsSync(tempRawPath)) {
          fs.unlinkSync(tempRawPath);
        }
      });

      it('should load sample RAW file successfully', () => {
        expect(rawBuffer).toBeInstanceOf(Buffer);
        expect(rawBuffer.length).toBeGreaterThan(0);
        expect(rawBuffer.length).toBe(expectedSize);
      });

      it('should convert RAW to JPEG', () => {
        const jpegImage = convertRaw(rawBuffer, OutputFormat.JPEG, {
          inputFormat,
        });

        expect(jpegImage).toHaveProperty('buffer');
        expect(jpegImage.buffer).toBeInstanceOf(Buffer);
        expect(jpegImage.buffer.length).toBeGreaterThan(0);

        // Verify JPEG header
        expect(jpegImage.buffer[0]).toBe(0xff);
        expect(jpegImage.buffer[1]).toBe(0xd8);
        expect(jpegImage.buffer[2]).toBe(0xff);

        // Save and verify file
        const outputPath = path.join(
          TEST_OUTPUT_DIR,
          `${formatName.toLowerCase()}_test_output.jpg`
        );
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
          convertRaw(Buffer.alloc(0), OutputFormat.JPEG, { inputFormat });
        }).toThrow('Input buffer is empty');

        // Invalid RAW data
        expect(() => {
          convertRaw(Buffer.from('invalid raw data'), OutputFormat.JPEG, {
            inputFormat,
          });
        }).toThrow('Output image has empty extent');
      });

      it('should support different output formats', () => {
        // Test JPEG format
        const jpegImage = convertRaw(rawBuffer, OutputFormat.JPEG, {
          inputFormat,
        });
        expect(jpegImage).toHaveProperty('buffer');
        expect(jpegImage.buffer).toBeInstanceOf(Buffer);
        expect(jpegImage.buffer.length).toBeGreaterThan(0);
        expect(jpegImage.buffer[0]).toBe(0xff);
        expect(jpegImage.buffer[1]).toBe(0xd8);

        // Test PNG format
        const pngImage = convertRaw(rawBuffer, OutputFormat.PNG, {
          inputFormat,
        });
        expect(pngImage).toHaveProperty('buffer');
        expect(pngImage.buffer).toBeInstanceOf(Buffer);
        expect(pngImage.buffer.length).toBeGreaterThan(0);
        expect(pngImage.buffer[0]).toBe(0x89);
        expect(pngImage.buffer[1]).toBe(0x50);
        expect(pngImage.buffer[2]).toBe(0x4e);
        expect(pngImage.buffer[3]).toBe(0x47);
        fs.writeFileSync(
          path.join(
            TEST_OUTPUT_DIR,
            `${formatName.toLowerCase()}_test_output.png`
          ),
          pngImage.buffer
        );

        // Test TIFF format
        const tiffImage = convertRaw(rawBuffer, OutputFormat.TIFF, {
          inputFormat,
        });
        expect(tiffImage).toHaveProperty('buffer');
        expect(tiffImage.buffer).toBeInstanceOf(Buffer);
        expect(tiffImage.buffer.length).toBeGreaterThan(0);
        const tiffHeader = tiffImage.buffer.toString('ascii', 0, 2);
        expect(['II', 'MM']).toContain(tiffHeader);
        fs.writeFileSync(
          path.join(
            TEST_OUTPUT_DIR,
            `${formatName.toLowerCase()}_test_output.tif`
          ),
          tiffImage.buffer
        );

        // Test RGB format (raw bitmap data)
        const rgbImage = convertRaw(rawBuffer, OutputFormat.RGB, {
          inputFormat,
        });
        expect(rgbImage).toHaveProperty('buffer');
        expect(rgbImage.buffer).toBeInstanceOf(Buffer);
        expect(rgbImage.buffer.length).toBeGreaterThan(0);

        // RGB buffer size depends on the specific RAW file dimensions
        const totalPixels = rgbImage.buffer.length / 3;
        expect(totalPixels).toBeGreaterThan(0);
        expect(rgbImage.buffer.length).toBe(dimensions.rgbBytes);
        expect(totalPixels).toBe(dimensions.pixels);

        // Test metadata (RGB format has default extractMetadata: false, so no metadata expected)
        expect(rgbImage.metadata).toBeUndefined();

        // Save RGB data to file
        fs.writeFileSync(
          path.join(
            TEST_OUTPUT_DIR,
            `${formatName.toLowerCase()}_test_output.bin`
          ),
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
          const heifImage = convertRaw(rawBuffer, OutputFormat.HEIF, {
            inputFormat,
          });
          expect(heifImage).toHaveProperty('buffer');
          expect(heifImage.buffer).toBeInstanceOf(Buffer);
          expect(heifImage.buffer.length).toBeGreaterThan(0);
          fs.writeFileSync(
            path.join(
              TEST_OUTPUT_DIR,
              `${formatName.toLowerCase()}_test_output.heif`
            ),
            heifImage.buffer
          );
        } catch (e) {
          // HEIF may not be supported on all systems, that's OK
        }
      });

      it('should reject invalid formats', () => {
        expect(() =>
          convertRaw(rawBuffer, 'bmp' as OutputFormat, { inputFormat })
        ).toThrow('Unsupported output format');
        expect(() =>
          convertRaw(rawBuffer, '' as OutputFormat, { inputFormat })
        ).toThrow('Output format must be a non-empty string');
        expect(() =>
          convertRaw(rawBuffer, 123 as any, { inputFormat })
        ).toThrow('Output format must be a non-empty string');
      });

      it('should support various conversion options', () => {
        // Lens correction
        const jpegWithLensCorrection = convertRaw(
          rawBuffer,
          OutputFormat.JPEG,
          {
            lensCorrection: true,
            inputFormat,
          }
        );
        expect(jpegWithLensCorrection).toHaveProperty('buffer');
        expect(jpegWithLensCorrection.buffer).toBeInstanceOf(Buffer);
        expect(jpegWithLensCorrection.buffer.length).toBeGreaterThan(0);

        // Exposure adjustment
        const jpegWithExposure = convertRaw(rawBuffer, OutputFormat.JPEG, {
          exposure: 1.0,
          inputFormat,
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
          inputFormat,
        });
        expect(jpegMultiOptions).toHaveProperty('buffer');
        expect(jpegMultiOptions.buffer).toBeInstanceOf(Buffer);
        expect(jpegMultiOptions.buffer.length).toBeGreaterThan(0);
      });

      it('should handle invalid options', () => {
        expect(() => {
          convertRaw(rawBuffer, OutputFormat.JPEG, 'invalid options' as any);
        }).toThrow('inputFormat is required when input is a Buffer');

        // Test with proper inputFormat but invalid options type
        expect(() => {
          convertRaw(
            `/path/to/file${fileExtension}`,
            OutputFormat.JPEG,
            'invalid options' as any
          );
        }).toThrow('Options must be an object');
      });

      it('should preserve EXIF metadata by default', async () => {
        // With EXIF preservation (default)
        const jpegWithExif = convertRaw(rawBuffer, OutputFormat.JPEG, {
          quality: 0.9,
          inputFormat,
        });
        const exifPath = path.join(
          TEST_OUTPUT_DIR,
          `${formatName.toLowerCase()}_test_with_exif.jpg`
        );
        fs.writeFileSync(exifPath, jpegWithExif.buffer);

        const metadataWithExif = await sharp(exifPath).metadata();
        expect(metadataWithExif.exif).toBeDefined();

        // Without EXIF preservation
        const jpegWithoutExif = convertRaw(rawBuffer, OutputFormat.JPEG, {
          quality: 0.9,
          preserveExifData: false,
          inputFormat,
        });
        const noExifPath = path.join(
          TEST_OUTPUT_DIR,
          `${formatName.toLowerCase()}_test_without_exif.jpg`
        );
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
          path.join(
            TEST_OUTPUT_DIR,
            `${formatName.toLowerCase()}_sync_path_test.jpg`
          ),
          jpegImage.buffer
        );
      });

      it('should convert RAW with wrong file extension when inputFormat is specified', () => {
        // Create temp copy with .txt extension
        const tempTxtPath = path.join(
          TEST_OUTPUT_DIR,
          `temp_misnamed${fileExtension.replace(/\.\w+$/, '.txt')}`
        );
        fs.copyFileSync(tempRawPath, tempTxtPath);

        try {
          const jpegImage = convertRaw(tempTxtPath, OutputFormat.JPEG, {
            quality: 0.9,
            inputFormat,
          });

          expect(jpegImage).toHaveProperty('buffer');
          expect(jpegImage.buffer).toBeInstanceOf(Buffer);
          expect(jpegImage.buffer.length).toBeGreaterThan(0);
          expect(jpegImage.buffer[0]).toBe(0xff);
          expect(jpegImage.buffer[1]).toBe(0xd8);

          fs.writeFileSync(
            path.join(
              TEST_OUTPUT_DIR,
              `${formatName.toLowerCase()}_misnamed_test.jpg`
            ),
            jpegImage.buffer
          );
        } finally {
          // Clean up temp file
          if (fs.existsSync(tempTxtPath)) {
            fs.unlinkSync(tempTxtPath);
          }
        }
      });

      it('should fail when wrong inputFormat is specified for file path', () => {
        // Try to process the RAW file as NEF format - this should fail because
        // the actual file format doesn't match the specified inputFormat
        expect(() => {
          convertRaw(tempRawPath, OutputFormat.JPEG, {
            inputFormat: 'nef',
          });
        }).toThrow();
      });

      it('should handle file path error cases', () => {
        // Non-existent file
        expect(() => {
          convertRaw(`/nonexistent/file${fileExtension}`, OutputFormat.JPEG);
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
          inputFormat,
        };

        const bufferResult = convertRaw(rawBuffer, OutputFormat.JPEG, options);
        const pathResult = convertRaw(tempRawPath, OutputFormat.JPEG, options);

        // Results should be very close (within 100 bytes due to potential timing differences)
        expect(
          Math.abs(bufferResult.buffer.length - pathResult.buffer.length)
        ).toBeLessThan(100);
      });
    }
  );

  describe.each(formatTestCases)(
    '$formatName Format - Asynchronous Conversion (convertRawAsync)',
    ({
      formatName,
      inputFormat,
      loadImage,
      expectedSize,
      fileExtension,
      dimensions,
      metadata,
    }) => {
      let rawBuffer: Buffer;
      let tempRawPath: string;

      beforeAll(() => {
        rawBuffer = loadImage();
        expect(rawBuffer).toBeInstanceOf(Buffer);
        expect(rawBuffer.length).toBeGreaterThan(0);
        expect(rawBuffer.length).toBe(expectedSize);

        // Create temporary RAW file for file path tests
        tempRawPath = path.join(
          TEST_OUTPUT_DIR,
          `temp_async_raw_file${fileExtension}`
        );
        fs.writeFileSync(tempRawPath, rawBuffer);
      });

      afterAll(() => {
        if (fs.existsSync(tempRawPath)) {
          fs.unlinkSync(tempRawPath);
        }
      });

      it('should convert RAW to JPEG using Buffer input', async () => {
        const jpegImage = await convertRawAsync(rawBuffer, OutputFormat.JPEG, {
          quality: 0.9,
          lensCorrection: true,
          inputFormat,
        });

        expect(jpegImage).toHaveProperty('buffer');
        expect(jpegImage.buffer).toBeInstanceOf(Buffer);
        expect(jpegImage.buffer.length).toBeGreaterThan(0);
        expect(jpegImage.buffer[0]).toBe(0xff);
        expect(jpegImage.buffer[1]).toBe(0xd8);

        fs.writeFileSync(
          path.join(
            TEST_OUTPUT_DIR,
            `${formatName.toLowerCase()}_async_buffer_test.jpg`
          ),
          jpegImage.buffer
        );
      });

      it('should convert RAW to JPEG using file path input', async () => {
        const jpegImage = await convertRawAsync(
          tempRawPath,
          OutputFormat.JPEG,
          {
            quality: 0.9,
            lensCorrection: true,
          }
        );

        expect(jpegImage).toHaveProperty('buffer');
        expect(jpegImage.buffer).toBeInstanceOf(Buffer);
        expect(jpegImage.buffer.length).toBeGreaterThan(0);
        expect(jpegImage.buffer[0]).toBe(0xff);
        expect(jpegImage.buffer[1]).toBe(0xd8);

        fs.writeFileSync(
          path.join(
            TEST_OUTPUT_DIR,
            `${formatName.toLowerCase()}_async_path_test.jpg`
          ),
          jpegImage.buffer
        );
      });

      it('should convert RAW with wrong file extension when inputFormat is specified (async)', async () => {
        // Create temp copy with .txt extension
        const tempTxtPath = path.join(
          TEST_OUTPUT_DIR,
          `temp_async_misnamed${fileExtension.replace(/\.\w+$/, '.txt')}`
        );
        fs.copyFileSync(tempRawPath, tempTxtPath);

        try {
          const jpegImage = await convertRawAsync(
            tempTxtPath,
            OutputFormat.JPEG,
            {
              quality: 0.9,
              inputFormat,
            }
          );

          expect(jpegImage).toHaveProperty('buffer');
          expect(jpegImage.buffer).toBeInstanceOf(Buffer);
          expect(jpegImage.buffer.length).toBeGreaterThan(0);
          expect(jpegImage.buffer[0]).toBe(0xff);
          expect(jpegImage.buffer[1]).toBe(0xd8);

          fs.writeFileSync(
            path.join(
              TEST_OUTPUT_DIR,
              `${formatName.toLowerCase()}_async_misnamed_test.jpg`
            ),
            jpegImage.buffer
          );
        } finally {
          // Clean up temp file
          if (fs.existsSync(tempTxtPath)) {
            fs.unlinkSync(tempTxtPath);
          }
        }
      });

      it('should fail when wrong inputFormat is specified for file path (async)', async () => {
        // Try to process the RAW file as NEF format - this should fail because
        // the actual file format doesn't match the specified inputFormat
        await expect(
          convertRawAsync(tempRawPath, OutputFormat.JPEG, {
            inputFormat: 'nef',
          })
        ).rejects.toThrow();
      });

      it('should handle async error cases', async () => {
        // Non-existent file
        await expect(
          convertRawAsync(
            `/nonexistent/file${fileExtension}`,
            OutputFormat.JPEG
          )
        ).rejects.toThrow('Failed to read file from path');

        // Empty buffer
        await expect(
          convertRawAsync(Buffer.alloc(0), OutputFormat.JPEG, {
            inputFormat,
          })
        ).rejects.toThrow('Input buffer is empty');

        // Invalid input type
        await expect(
          convertRawAsync(123 as any, OutputFormat.JPEG)
        ).rejects.toThrow('Input must be a Buffer or file path string');

        // Unsupported format
        await expect(
          convertRawAsync(rawBuffer, 'bmp' as OutputFormat, { inputFormat })
        ).rejects.toThrow('Unsupported output format');
      });

      it('should handle multiple concurrent conversions', async () => {
        const concurrentPromises = [
          convertRawAsync(rawBuffer, OutputFormat.JPEG, {
            quality: 0.8,
            scaleFactor: 0.5,
            inputFormat,
          }),
          convertRawAsync(tempRawPath, OutputFormat.PNG, {
            scaleFactor: 0.5,
          }),
          convertRawAsync(rawBuffer, OutputFormat.TIFF, {
            scaleFactor: 0.5,
            inputFormat,
          }),
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
          path.join(
            TEST_OUTPUT_DIR,
            `${formatName.toLowerCase()}_concurrent_test.jpg`
          ),
          jpegResult.buffer
        );
        fs.writeFileSync(
          path.join(
            TEST_OUTPUT_DIR,
            `${formatName.toLowerCase()}_concurrent_test.png`
          ),
          pngResult.buffer
        );
        fs.writeFileSync(
          path.join(
            TEST_OUTPUT_DIR,
            `${formatName.toLowerCase()}_concurrent_test.tif`
          ),
          tiffResult.buffer
        );
      });

      it('should produce consistent results with sync version', async () => {
        const options = {
          quality: 0.85,
          lensCorrection: true,
          preserveExifData: false,
          inputFormat,
        };

        const syncResult = convertRaw(rawBuffer, OutputFormat.JPEG, options);
        const asyncResult = await convertRawAsync(
          rawBuffer,
          OutputFormat.JPEG,
          options
        );

        // Results should be very close (within 100 bytes due to potential timing differences)
        expect(
          Math.abs(syncResult.buffer.length - asyncResult.buffer.length)
        ).toBeLessThan(100);
      });

      it('should handle large batches without issues', async () => {
        const batchSize = 5;
        const batchPromises = Array.from({ length: batchSize }, (_, i) =>
          convertRawAsync(rawBuffer, OutputFormat.JPEG, {
            quality: 0.7 + i * 0.05,
            scaleFactor: 0.3,
            lensCorrection: i % 2 === 0,
            inputFormat,
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
          inputFormat,
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
          inputFormat,
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
        const rgbImage = await convertRawAsync(rawBuffer, OutputFormat.RGB, {
          inputFormat,
        });

        expect(rgbImage).toHaveProperty('buffer');
        expect(rgbImage.buffer).toBeInstanceOf(Buffer);
        expect(rgbImage.buffer.length).toBeGreaterThan(0);

        // RGB buffer size depends on the specific RAW file dimensions
        const totalPixels = rgbImage.buffer.length / 3;
        expect(totalPixels).toBeGreaterThan(0);
        expect(rgbImage.buffer.length).toBe(dimensions.rgbBytes);
        expect(totalPixels).toBe(dimensions.pixels);

        // Test metadata (RGB format has default extractMetadata: false, so no metadata expected)
        expect(rgbImage.metadata).toBeUndefined();

        // Save async RGB data to file (different name to avoid conflicts)
        fs.writeFileSync(
          path.join(
            TEST_OUTPUT_DIR,
            `${formatName.toLowerCase()}_async_test_output.bin`
          ),
          rgbImage.buffer
        );

        // Should produce consistent results with sync version
        const syncRgbImage = convertRaw(rawBuffer, OutputFormat.RGB, {
          inputFormat,
        });
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
        const jpegWithMetadata = await convertRawAsync(
          rawBuffer,
          OutputFormat.JPEG,
          {
            extractMetadata: true,
            inputFormat,
          }
        );

        expect(jpegWithMetadata).toHaveProperty('buffer');
        expect(jpegWithMetadata).toHaveProperty('metadata');
        expect(jpegWithMetadata.metadata).toBeDefined();

        // Check metadata expectations based on format
        expect(jpegWithMetadata.metadata?.width).toBe(dimensions.width);
        expect(jpegWithMetadata.metadata?.height).toBe(dimensions.height);
        expect(jpegWithMetadata.metadata?.cameraMake).toBe(metadata.cameraMake);
        expect(jpegWithMetadata.metadata?.cameraModel).toBe(
          metadata.cameraModel
        );
        expect(jpegWithMetadata.metadata?.focalLength35mm).toBe(
          metadata.focalLength35mm
        );
        expect(jpegWithMetadata.metadata?.fNumber).toBe(metadata.fNumber);

        if (formatName === 'DNG') {
          expect(jpegWithMetadata.metadata?.shutterSpeed).toBeCloseTo(
            metadata.shutterSpeed
          );
        } else {
          expect(jpegWithMetadata.metadata?.shutterSpeed).toBe(
            metadata.shutterSpeed
          );
        }

        // Test JPEG without metadata (default)
        const jpegWithoutMetadata = await convertRawAsync(
          rawBuffer,
          OutputFormat.JPEG,
          { inputFormat }
        );
        expect(jpegWithoutMetadata).toHaveProperty('buffer');
        expect(jpegWithoutMetadata.metadata).toBeUndefined();

        // Test RGB with metadata
        const rgbWithMetadata = await convertRawAsync(
          rawBuffer,
          OutputFormat.RGB,
          {
            extractMetadata: true,
            inputFormat,
          }
        );

        expect(rgbWithMetadata).toHaveProperty('buffer');
        expect(rgbWithMetadata).toHaveProperty('metadata');
        expect(rgbWithMetadata.metadata).toBeDefined();

        expect(rgbWithMetadata.metadata?.width).toBe(dimensions.width);
        expect(rgbWithMetadata.metadata?.height).toBe(dimensions.height);
      });

      it('should handle RGB format with extractMetadata without crashing', async () => {
        // This test specifically verifies the fix for the segfault issue
        // that occurred when using RGB format with extractMetadata: true

        const rgbResult = await convertRawAsync(rawBuffer, OutputFormat.RGB, {
          extractMetadata: true,
          lensCorrection: true,
          boost: 0.0,
          inputFormat,
        });

        // Verify the output is valid
        expect(rgbResult).toHaveProperty('buffer');
        expect(rgbResult.buffer).toBeInstanceOf(Buffer);

        expect(rgbResult.buffer.length).toBe(dimensions.rgbBytes);

        // Verify metadata was extracted correctly
        expect(rgbResult).toHaveProperty('metadata');
        expect(rgbResult.metadata).toBeDefined();

        expect(rgbResult.metadata?.width).toBe(dimensions.width);
        expect(rgbResult.metadata?.height).toBe(dimensions.height);

        // Check for camera metadata
        expect(rgbResult.metadata?.cameraMake).toBeDefined();
        expect(rgbResult.metadata?.cameraModel).toBeDefined();
        expect(rgbResult.metadata?.cameraMake).toBe(metadata.cameraMake);
        expect(rgbResult.metadata?.cameraModel).toBe(metadata.cameraModel);

        // Check for EXIF metadata
        expect(rgbResult.metadata?.focalLength35mm).toBeDefined();
        expect(rgbResult.metadata?.fNumber).toBeDefined();
        expect(rgbResult.metadata?.shutterSpeed).toBeDefined();

        // Multiple conversions should not cause issues
        const secondRgbResult = await convertRawAsync(
          rawBuffer,
          OutputFormat.RGB,
          {
            extractMetadata: true,
            inputFormat,
          }
        );

        expect(secondRgbResult).toHaveProperty('buffer');

        expect(secondRgbResult.buffer.length).toBe(dimensions.rgbBytes);
        expect(secondRgbResult.metadata?.width).toBe(dimensions.width);
        expect(secondRgbResult.metadata?.height).toBe(dimensions.height);
      });
    }
  );

  describe.each(formatTestCases)(
    '$formatName Format - Performance Tests',
    ({ inputFormat, loadImage }) => {
      let rawBuffer: Buffer;

      beforeAll(() => {
        rawBuffer = loadImage();
      });

      it('should complete conversions within reasonable time', async () => {
        const iterations = 3;
        const startTime = Date.now();

        for (let i = 0; i < iterations; i++) {
          convertRaw(rawBuffer, OutputFormat.JPEG, { inputFormat });
        }

        const totalTime = Date.now() - startTime;
        const avgTime = totalTime / iterations;

        expect(avgTime).toBeLessThan(2000); // Should complete within 2 seconds
      });
    }
  );
});
