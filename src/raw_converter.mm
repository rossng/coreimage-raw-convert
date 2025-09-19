#import <nan.h>
#import <CoreImage/CoreImage.h>
#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>
#import <AppKit/AppKit.h>
#include <string>

using namespace v8;

// Options structure for conversion
struct InternalConversionOptions {
    bool lensCorrection = true;
    double exposure = 0.0;
    double boost = 1.0;
    double boostShadowAmount = 0.0;
    double baselineExposure = 0.0;
    double neutralTemperature = -1.0;
    double neutralTint = -1.0;
    bool disableGamutMap = false;
    bool allowDraftMode = false;
    bool ignoreImageOrientation = false;
    double colorNoiseReductionAmount = -1.0;
    double luminanceNoiseReductionAmount = -1.0;
    double contrastAmount = -1.0;
    double sharpnessAmount = -1.0;
    double noiseReductionAmount = -1.0;
    double localToneMapAmount = -1.0;
    double scaleFactor = 1.0;
    double quality = -1.0;
    bool embedThumbnail = false;
    bool optimizeColorForSharing = false;
    bool preserveExifData = true;
    bool extractMetadata = false;
    std::string inputFormat;
};

// Helper function to extract metadata from CGImage source
static Local<Object> ExtractImageMetadata(CFDictionaryRef sourceMetadataRef, CGImageRef cgImage) {
    Nan::EscapableHandleScope scope;
    Local<Object> metadata = Nan::New<Object>();
    
    if (cgImage) {
        // Basic image dimensions
        Nan::Set(metadata, Nan::New("width").ToLocalChecked(), Nan::New<Number>(CGImageGetWidth(cgImage)));
        Nan::Set(metadata, Nan::New("height").ToLocalChecked(), Nan::New<Number>(CGImageGetHeight(cgImage)));
    }
    
    if (sourceMetadataRef) {
        NSDictionary* sourceMetadata = (__bridge NSDictionary*)sourceMetadataRef;
        
        // Extract EXIF data
        NSDictionary* exifDict = sourceMetadata[(NSString*)kCGImagePropertyExifDictionary];
        if (exifDict) {
            // Focal length (35mm equivalent)
            NSNumber* focalLength35mm = exifDict[(NSString*)kCGImagePropertyExifFocalLenIn35mmFilm];
            if (focalLength35mm) {
                Nan::Set(metadata, Nan::New("focalLength35mm").ToLocalChecked(), Nan::New<Number>([focalLength35mm doubleValue]));
            }
            
            // Shutter speed
            NSNumber* exposureTime = exifDict[(NSString*)kCGImagePropertyExifExposureTime];
            if (exposureTime) {
                Nan::Set(metadata, Nan::New("shutterSpeed").ToLocalChecked(), Nan::New<Number>([exposureTime doubleValue]));
            }
            
            // F-number
            NSNumber* fNumber = exifDict[(NSString*)kCGImagePropertyExifFNumber];
            if (fNumber) {
                Nan::Set(metadata, Nan::New("fNumber").ToLocalChecked(), Nan::New<Number>([fNumber doubleValue]));
            }

            // ISO speed
            NSArray* isoSpeedRatings = exifDict[(NSString*)kCGImagePropertyExifISOSpeedRatings];
            if (isoSpeedRatings && [isoSpeedRatings count] > 0) {
                NSNumber* iso = isoSpeedRatings[0];
                Nan::Set(metadata, Nan::New("iso").ToLocalChecked(), Nan::New<Number>([iso doubleValue]));
            }

            // Date/time original
            NSString* dateTimeOriginal = exifDict[(NSString*)kCGImagePropertyExifDateTimeOriginal];
            if (dateTimeOriginal) {
                Nan::Set(metadata, Nan::New("dateTimeOriginal").ToLocalChecked(), Nan::New<String>([dateTimeOriginal UTF8String]).ToLocalChecked());
            }

            // Lens make
            NSString* lensMake = exifDict[(NSString*)kCGImagePropertyExifLensMake];
            if (lensMake) {
                Nan::Set(metadata, Nan::New("lensMake").ToLocalChecked(), Nan::New<String>([lensMake UTF8String]).ToLocalChecked());
            }

            // Lens model
            NSString* lensModel = exifDict[(NSString*)kCGImagePropertyExifLensModel];
            if (lensModel) {
                Nan::Set(metadata, Nan::New("lensModel").ToLocalChecked(), Nan::New<String>([lensModel UTF8String]).ToLocalChecked());
            }

            // Focal length (actual, not 35mm equivalent)
            NSNumber* focalLength = exifDict[(NSString*)kCGImagePropertyExifFocalLength];
            if (focalLength) {
                Nan::Set(metadata, Nan::New("focalLength").ToLocalChecked(), Nan::New<Number>([focalLength doubleValue]));
            }

            // White balance mode
            NSNumber* whiteBalance = exifDict[(NSString*)kCGImagePropertyExifWhiteBalance];
            if (whiteBalance) {
                Nan::Set(metadata, Nan::New("whiteBalance").ToLocalChecked(), Nan::New<Number>([whiteBalance intValue]));
            }

            // Exposure mode
            NSNumber* exposureMode = exifDict[(NSString*)kCGImagePropertyExifExposureMode];
            if (exposureMode) {
                Nan::Set(metadata, Nan::New("exposureMode").ToLocalChecked(), Nan::New<Number>([exposureMode intValue]));
            }

            // Exposure bias
            NSNumber* exposureBias = exifDict[(NSString*)kCGImagePropertyExifExposureBiasValue];
            if (exposureBias) {
                Nan::Set(metadata, Nan::New("exposureBias").ToLocalChecked(), Nan::New<Number>([exposureBias doubleValue]));
            }
        }
        
        // Extract TIFF data (camera make/model)
        NSDictionary* tiffDict = sourceMetadata[(NSString*)kCGImagePropertyTIFFDictionary];
        if (tiffDict) {
            // Camera make
            NSString* make = tiffDict[(NSString*)kCGImagePropertyTIFFMake];
            if (make) {
                Nan::Set(metadata, Nan::New("cameraMake").ToLocalChecked(), Nan::New<String>([make UTF8String]).ToLocalChecked());
            }
            
            // Camera model
            NSString* model = tiffDict[(NSString*)kCGImagePropertyTIFFModel];
            if (model) {
                Nan::Set(metadata, Nan::New("cameraModel").ToLocalChecked(), Nan::New<String>([model UTF8String]).ToLocalChecked());
            }

            // Software
            NSString* software = tiffDict[(NSString*)kCGImagePropertyTIFFSoftware];
            if (software) {
                Nan::Set(metadata, Nan::New("software").ToLocalChecked(), Nan::New<String>([software UTF8String]).ToLocalChecked());
            }

            // Orientation
            NSNumber* orientation = tiffDict[(NSString*)kCGImagePropertyTIFFOrientation];
            if (orientation) {
                Nan::Set(metadata, Nan::New("orientation").ToLocalChecked(), Nan::New<Number>([orientation intValue]));
            }
        }

        // GPS data
        NSDictionary* gpsDict = sourceMetadata[(NSString*)kCGImagePropertyGPSDictionary];
        if (gpsDict) {
            // Latitude
            NSNumber* latitude = gpsDict[(NSString*)kCGImagePropertyGPSLatitude];
            NSString* latitudeRef = gpsDict[(NSString*)kCGImagePropertyGPSLatitudeRef];
            if (latitude && latitudeRef) {
                double lat = [latitude doubleValue];
                if ([latitudeRef isEqualToString:@"S"]) {
                    lat = -lat;
                }
                Nan::Set(metadata, Nan::New("latitude").ToLocalChecked(), Nan::New<Number>(lat));
            }

            // Longitude
            NSNumber* longitude = gpsDict[(NSString*)kCGImagePropertyGPSLongitude];
            NSString* longitudeRef = gpsDict[(NSString*)kCGImagePropertyGPSLongitudeRef];
            if (longitude && longitudeRef) {
                double lon = [longitude doubleValue];
                if ([longitudeRef isEqualToString:@"W"]) {
                    lon = -lon;
                }
                Nan::Set(metadata, Nan::New("longitude").ToLocalChecked(), Nan::New<Number>(lon));
            }

            // Altitude
            NSNumber* altitude = gpsDict[(NSString*)kCGImagePropertyGPSAltitude];
            if (altitude) {
                Nan::Set(metadata, Nan::New("altitude").ToLocalChecked(), Nan::New<Number>([altitude doubleValue]));
            }
        }
    }
    
    return scope.Escape(metadata);
}

// Helper function to extract RGB data from CGImage
static bool ExtractRgbData(CGImageRef cgImage, CGColorSpaceRef colorSpace, char** outputData, size_t* outputLength) {
    // Try to get raw data directly from the CGImage first
    CGDataProviderRef dataProvider = CGImageGetDataProvider(cgImage);
    if (dataProvider) {
        CFDataRef rawData = CGDataProviderCopyData(dataProvider);
        if (rawData) {
            const UInt8* bytes = CFDataGetBytePtr(rawData);
            size_t dataLength = CFDataGetLength(rawData);
            
            // Check if this is RGBA data (4 bytes per pixel)
            size_t width = CGImageGetWidth(cgImage);
            size_t height = CGImageGetHeight(cgImage);
            size_t expectedRgbaSize = width * height * 4;
            
            if (dataLength == expectedRgbaSize) {
                // Convert RGBA to RGB
                size_t rgbSize = width * height * 3;
                unsigned char* rgbData = (unsigned char*)malloc(rgbSize);
                if (rgbData) {
                    for (size_t i = 0, j = 0; i < dataLength; i += 4, j += 3) {
                        rgbData[j] = bytes[i];     // R
                        rgbData[j+1] = bytes[i+1]; // G  
                        rgbData[j+2] = bytes[i+2]; // B
                        // Skip alpha at i+3
                    }
                    
                    *outputLength = rgbSize;
                    *outputData = new char[*outputLength];
                    memcpy(*outputData, rgbData, *outputLength);
                    
                    free(rgbData);
                    CFRelease(rawData);
                    return true;
                }
            }
            
            CFRelease(rawData);
        }
    }
    
    // Fallback to bitmap context approach if direct access fails
    size_t width = CGImageGetWidth(cgImage);
    size_t height = CGImageGetHeight(cgImage);
    size_t bytesPerPixel = 4; // RGBA for bitmap context
    size_t bytesPerRow = width * bytesPerPixel;
    size_t totalBytes = height * bytesPerRow;
    
    unsigned char* rgbaData = (unsigned char*)malloc(totalBytes);
    if (!rgbaData) {
        return false;
    }
    
    CGContextRef bitmapContext = CGBitmapContextCreate(
        rgbaData,
        width,
        height,
        8,
        bytesPerRow,
        colorSpace,
        kCGImageAlphaNoneSkipLast | kCGBitmapByteOrder32Big
    );
    
    if (!bitmapContext) {
        free(rgbaData);
        return false;
    }
    
    CGContextDrawImage(bitmapContext, CGRectMake(0, 0, width, height), cgImage);
    
    // Convert RGBA to RGB
    size_t rgbSize = width * height * 3;
    unsigned char* rgbOnlyData = (unsigned char*)malloc(rgbSize);
    if (!rgbOnlyData) {
        CGContextRelease(bitmapContext);
        free(rgbaData);
        return false;
    }
    
    for (size_t i = 0, j = 0; i < totalBytes; i += 4, j += 3) {
        rgbOnlyData[j] = rgbaData[i];
        rgbOnlyData[j+1] = rgbaData[i+1];
        rgbOnlyData[j+2] = rgbaData[i+2];
    }
    
    *outputLength = rgbSize;
    *outputData = new char[*outputLength];
    memcpy(*outputData, rgbOnlyData, *outputLength);
    
    free(rgbOnlyData);
    CGContextRelease(bitmapContext);
    free(rgbaData);
    return true;
}

// AsyncWorker class for background RAW conversion
class ConvertRawAsyncWorker : public Nan::AsyncWorker {
public:
    ConvertRawAsyncWorker(Nan::Callback *callback, 
                         bool isFilePath,
                         const std::string& filePath,
                         char* bufferData,
                         size_t bufferLength,
                         const std::string& format,
                         const InternalConversionOptions& options)
        : Nan::AsyncWorker(callback), 
          isFilePath_(isFilePath),
          filePath_(filePath),
          bufferData_(nullptr),
          bufferLength_(bufferLength), 
          format_(format),
          options_(options),
          outputData_(nullptr),
          outputLength_(0) {
        
        // If we have buffer data, copy it for safe access in background thread
        if (bufferData && bufferLength > 0) {
            bufferData_ = new char[bufferLength];
            memcpy(bufferData_, bufferData, bufferLength);
        }
    }

    ~ConvertRawAsyncWorker() {
        delete[] bufferData_;
        delete[] outputData_;
    }

    // Background thread execution
    void Execute() override;
    
    // Main thread success callback
    void HandleOKCallback() override;
    
    // Main thread error callback  
    void HandleErrorCallback() override;

private:
    bool isFilePath_;
    std::string filePath_;
    char* bufferData_;
    size_t bufferLength_;
    std::string format_;
    InternalConversionOptions options_;
    
    // Output data
    char* outputData_;
    size_t outputLength_;
    
    // Metadata storage for background thread (plain C++ data)
    struct MetadataStorage {
        size_t width = 0;
        size_t height = 0;
        double focalLength35mm = -1;
        double shutterSpeed = -1;
        double fNumber = -1;
        std::string cameraMake;
        std::string cameraModel;
        double iso = -1;
        std::string dateTimeOriginal;
        std::string lensMake;
        std::string lensModel;
        double focalLength = -1;
        int whiteBalance = -1;
        int exposureMode = -1;
        double exposureBias = -999;
        std::string software;
        int orientation = -1;
        double latitude = -999;
        double longitude = -999;
        double altitude = -999;
        bool hasMetadata = false;
    } metadataStorage_;
};

// Implementation of AsyncWorker methods
void ConvertRawAsyncWorker::Execute() {
    @autoreleasepool {
        NSData* imageData = nil;
        
        // Load image data based on input type
        if (isFilePath_) {
            // Load from file path
            NSString* nsFilePath = [NSString stringWithUTF8String:filePath_.c_str()];
            imageData = [NSData dataWithContentsOfFile:nsFilePath];
            
            if (!imageData) {
                SetErrorMessage("Failed to read file from path");
                return;
            }
        } else {
            // Use buffer data
            if (!bufferData_ || bufferLength_ == 0) {
                SetErrorMessage("Invalid buffer data");
                return;
            }
            imageData = [NSData dataWithBytes:bufferData_ length:bufferLength_];
        }
        
        // Write data to a temporary file because CIRAWFilter works better with file URLs
        NSString* tempPath = [NSTemporaryDirectory() stringByAppendingPathComponent:[[NSUUID UUID] UUIDString]];
        // Use inputFormat if specified, otherwise use original file extension
        NSString* fileExtension = nil;
        if (!options_.inputFormat.empty()) {
            // inputFormat takes precedence
            fileExtension = [NSString stringWithUTF8String:options_.inputFormat.c_str()];
        } else if (isFilePath_) {
            // Fall back to original file extension
            NSString* originalPath = [NSString stringWithUTF8String:filePath_.c_str()];
            NSString* originalExt = [originalPath pathExtension];
            if ([originalExt length] > 0) {
                fileExtension = originalExt;
            }
        }
        
        // Only append extension if we have one
        if (fileExtension && [fileExtension length] > 0) {
            tempPath = [tempPath stringByAppendingPathExtension:fileExtension];
        }
        
        NSError* writeError = nil;
        BOOL written = [imageData writeToFile:tempPath options:NSDataWritingAtomic error:&writeError];
        
        if (!written) {
            NSString* errorMsg = [NSString stringWithFormat:@"Failed to write temp file: %@", writeError.localizedDescription];
            SetErrorMessage([errorMsg UTF8String]);
            return;
        }
        
        // Create URL for the temp file
        NSURL* fileURL = [NSURL fileURLWithPath:tempPath];
        
        // Read metadata from source if preservation is requested
        NSDictionary* sourceMetadata = nil;
        CFDictionaryRef sourceMetadataRef = NULL;
        if (options_.preserveExifData) {
            CGImageSourceRef imageSource = CGImageSourceCreateWithURL((__bridge CFURLRef)fileURL, NULL);
            if (imageSource) {
                sourceMetadataRef = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, NULL);
                sourceMetadata = (__bridge NSDictionary*)sourceMetadataRef;
                CFRelease(imageSource);
            }
        }
        
        // Create RAW filter options
        NSMutableDictionary* rawOptions = [NSMutableDictionary dictionary];
        
        // Basic options
        rawOptions[kCIInputEnableVendorLensCorrectionKey] = options_.lensCorrection ? @YES : @NO;
        rawOptions[kCIInputBoostKey] = @(options_.boost);
        
        // Exposure options
        rawOptions[kCIInputEVKey] = @(options_.exposure);
        if (options_.baselineExposure != 0.0) {
            rawOptions[kCIInputBaselineExposureKey] = @(options_.baselineExposure);
        }
        if (options_.boostShadowAmount != 0.0) {
            rawOptions[kCIInputBoostShadowAmountKey] = @(options_.boostShadowAmount);
        }
        
        // Color options
        if (options_.neutralTemperature >= 0) {
            rawOptions[kCIInputNeutralTemperatureKey] = @(options_.neutralTemperature);
        }
        if (options_.neutralTint >= 0) {
            rawOptions[kCIInputNeutralTintKey] = @(options_.neutralTint);
        }
        
        // Other options
        if (options_.disableGamutMap) {
            rawOptions[kCIInputDisableGamutMapKey] = @YES;
        }
        if (options_.allowDraftMode) {
            rawOptions[kCIInputAllowDraftModeKey] = @YES;
        }
        if (options_.ignoreImageOrientation) {
            rawOptions[kCIInputIgnoreImageOrientationKey] = @YES;
        }
        
        // Noise reduction options
        if (options_.colorNoiseReductionAmount >= 0) {
            rawOptions[kCIInputColorNoiseReductionAmountKey] = @(options_.colorNoiseReductionAmount);
        }
        if (options_.luminanceNoiseReductionAmount >= 0) {
            rawOptions[kCIInputLuminanceNoiseReductionAmountKey] = @(options_.luminanceNoiseReductionAmount);
        }
        
        // Enhancement options
        if (options_.contrastAmount >= 0) {
            rawOptions[kCIInputContrastKey] = @(options_.contrastAmount);
        }
        if (options_.sharpnessAmount >= 0) {
            rawOptions[kCIInputSharpnessKey] = @(options_.sharpnessAmount);
        }
        
        // Additional processing options
        if (options_.noiseReductionAmount >= 0) {
            rawOptions[kCIInputNoiseReductionAmountKey] = @(options_.noiseReductionAmount);
        }
        
        if (@available(macOS 11.1, *)) {
            if (options_.localToneMapAmount >= 0) {
                rawOptions[kCIInputLocalToneMapAmountKey] = @(options_.localToneMapAmount);
            }
        }
        
        if (options_.scaleFactor != 1.0) {
            rawOptions[kCIInputScaleFactorKey] = @(options_.scaleFactor);
        }
        
        if (@available(macOS 10.14, *)) {
            rawOptions[kCIInputEnableEDRModeKey] = @NO;
        }
        
        // Create CIFilter from file URL
        CIFilter* rawFilter = [CIFilter filterWithImageURL:fileURL options:rawOptions];
        
        // Clean up temp file
        [[NSFileManager defaultManager] removeItemAtPath:tempPath error:nil];
        
        if (!rawFilter) {
            SetErrorMessage("Failed to create CIRAWFilter from image data");
            return;
        }
        
        // Get the output image
        CIImage* outputImage = rawFilter.outputImage;
        
        if (!outputImage) {
            SetErrorMessage("Failed to get output image from RAW filter");
            return;
        }
        
        // Create CIContext for rendering
        CIContext* context = [CIContext context];
        
        // Get the image extent
        CGRect extent = [outputImage extent];
        
        if (CGRectIsEmpty(extent)) {
            SetErrorMessage("Output image has empty extent");
            return;
        }
        
        // Create a color space
        CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
        
        // Render CIImage to CGImage
        CGImageRef cgImage = [context createCGImage:outputImage fromRect:extent];
        
        if (!cgImage) {
            CGColorSpaceRelease(colorSpace);
            SetErrorMessage("Failed to create CGImage from CIImage");
            return;
        }
        
        // Extract metadata if requested (store as plain C++ data for thread safety)
        if (options_.extractMetadata) {
            metadataStorage_.hasMetadata = true;
            
            // Basic image dimensions
            if (cgImage) {
                metadataStorage_.width = CGImageGetWidth(cgImage);
                metadataStorage_.height = CGImageGetHeight(cgImage);
            }
            
            if (sourceMetadataRef) {
                NSDictionary* sourceMetadata = (__bridge NSDictionary*)sourceMetadataRef;
                
                // Extract EXIF data
                NSDictionary* exifDict = sourceMetadata[(NSString*)kCGImagePropertyExifDictionary];
                if (exifDict) {
                    NSNumber* focalLength35mm = exifDict[(NSString*)kCGImagePropertyExifFocalLenIn35mmFilm];
                    if (focalLength35mm) {
                        metadataStorage_.focalLength35mm = [focalLength35mm doubleValue];
                    }
                    
                    NSNumber* exposureTime = exifDict[(NSString*)kCGImagePropertyExifExposureTime];
                    if (exposureTime) {
                        metadataStorage_.shutterSpeed = [exposureTime doubleValue];
                    }
                    
                    NSNumber* fNumber = exifDict[(NSString*)kCGImagePropertyExifFNumber];
                    if (fNumber) {
                        metadataStorage_.fNumber = [fNumber doubleValue];
                    }

                    NSArray* isoSpeedRatings = exifDict[(NSString*)kCGImagePropertyExifISOSpeedRatings];
                    if (isoSpeedRatings && [isoSpeedRatings count] > 0) {
                        NSNumber* iso = isoSpeedRatings[0];
                        metadataStorage_.iso = [iso doubleValue];
                    }

                    NSString* dateTimeOriginal = exifDict[(NSString*)kCGImagePropertyExifDateTimeOriginal];
                    if (dateTimeOriginal) {
                        metadataStorage_.dateTimeOriginal = [dateTimeOriginal UTF8String];
                    }

                    NSString* lensMake = exifDict[(NSString*)kCGImagePropertyExifLensMake];
                    if (lensMake) {
                        metadataStorage_.lensMake = [lensMake UTF8String];
                    }

                    NSString* lensModel = exifDict[(NSString*)kCGImagePropertyExifLensModel];
                    if (lensModel) {
                        metadataStorage_.lensModel = [lensModel UTF8String];
                    }

                    NSNumber* focalLength = exifDict[(NSString*)kCGImagePropertyExifFocalLength];
                    if (focalLength) {
                        metadataStorage_.focalLength = [focalLength doubleValue];
                    }

                    NSNumber* whiteBalance = exifDict[(NSString*)kCGImagePropertyExifWhiteBalance];
                    if (whiteBalance) {
                        metadataStorage_.whiteBalance = [whiteBalance intValue];
                    }

                    NSNumber* exposureMode = exifDict[(NSString*)kCGImagePropertyExifExposureMode];
                    if (exposureMode) {
                        metadataStorage_.exposureMode = [exposureMode intValue];
                    }

                    NSNumber* exposureBias = exifDict[(NSString*)kCGImagePropertyExifExposureBiasValue];
                    if (exposureBias) {
                        metadataStorage_.exposureBias = [exposureBias doubleValue];
                    }
                }
                
                // Extract TIFF data
                NSDictionary* tiffDict = sourceMetadata[(NSString*)kCGImagePropertyTIFFDictionary];
                if (tiffDict) {
                    NSString* make = tiffDict[(NSString*)kCGImagePropertyTIFFMake];
                    if (make) {
                        metadataStorage_.cameraMake = [make UTF8String];
                    }
                    
                    NSString* model = tiffDict[(NSString*)kCGImagePropertyTIFFModel];
                    if (model) {
                        metadataStorage_.cameraModel = [model UTF8String];
                    }

                    NSString* software = tiffDict[(NSString*)kCGImagePropertyTIFFSoftware];
                    if (software) {
                        metadataStorage_.software = [software UTF8String];
                    }

                    NSNumber* orientation = tiffDict[(NSString*)kCGImagePropertyTIFFOrientation];
                    if (orientation) {
                        metadataStorage_.orientation = [orientation intValue];
                    }
                }

                // GPS data
                NSDictionary* gpsDict = sourceMetadata[(NSString*)kCGImagePropertyGPSDictionary];
                if (gpsDict) {
                    NSNumber* latitude = gpsDict[(NSString*)kCGImagePropertyGPSLatitude];
                    NSString* latitudeRef = gpsDict[(NSString*)kCGImagePropertyGPSLatitudeRef];
                    if (latitude && latitudeRef) {
                        double lat = [latitude doubleValue];
                        if ([latitudeRef isEqualToString:@"S"]) {
                            lat = -lat;
                        }
                        metadataStorage_.latitude = lat;
                    }

                    NSNumber* longitude = gpsDict[(NSString*)kCGImagePropertyGPSLongitude];
                    NSString* longitudeRef = gpsDict[(NSString*)kCGImagePropertyGPSLongitudeRef];
                    if (longitude && longitudeRef) {
                        double lon = [longitude doubleValue];
                        if ([longitudeRef isEqualToString:@"W"]) {
                            lon = -lon;
                        }
                        metadataStorage_.longitude = lon;
                    }

                    NSNumber* altitude = gpsDict[(NSString*)kCGImagePropertyGPSAltitude];
                    if (altitude) {
                        metadataStorage_.altitude = [altitude doubleValue];
                    }
                }
            }
        }
        
        // Handle RGB format separately (raw bitmap data)
        std::string format = format_;
        if (format == "rgb") {
            if (ExtractRgbData(cgImage, colorSpace, &outputData_, &outputLength_)) {
                CGColorSpaceRelease(colorSpace);
                CGImageRelease(cgImage);
                if (sourceMetadataRef) {
                    CFRelease(sourceMetadataRef);
                }
                return;
            } else {
                CGColorSpaceRelease(colorSpace);
                CGImageRelease(cgImage);
                if (sourceMetadataRef) {
                    CFRelease(sourceMetadataRef);
                }
                SetErrorMessage("Failed to extract RGB data from image");
                return;
            }
        }
        
        // Determine the UTI for the output format
        CFStringRef outputUTI;
        if (format == "jpeg" || format == "jpg") {
            outputUTI = CFSTR("public.jpeg");
        } else if (format == "png") {
            outputUTI = CFSTR("public.png");
        } else if (format == "tiff" || format == "tif") {
            outputUTI = CFSTR("public.tiff");
        } else if (format == "jpeg2000" || format == "jp2") {
            outputUTI = CFSTR("public.jpeg-2000");
        } else if (format == "heif" || format == "heic") {
            outputUTI = CFSTR("public.heic");
        } else {
            CGColorSpaceRelease(colorSpace);
            CGImageRelease(cgImage);
            std::string errorMsg = "Unsupported output format: " + format + ". Supported formats: jpeg, jpg, png, tiff, tif, jpeg2000, jp2, heif, heic, rgb";
            SetErrorMessage(errorMsg.c_str());
            return;
        }
        
        // Create output data
        NSMutableData* outputData = [NSMutableData data];
        CGImageDestinationRef destination = CGImageDestinationCreateWithData(
            (__bridge CFMutableDataRef)outputData,
            outputUTI,
            1,
            NULL
        );
        
        if (!destination) {
            CGImageRelease(cgImage);
            CGColorSpaceRelease(colorSpace);
            SetErrorMessage("Failed to create image destination");
            return;
        }
        
        // Set format-specific properties
        NSMutableDictionary* properties = [NSMutableDictionary dictionary];
        
        // Set compression quality for lossy formats
        if (format == "jpeg" || format == "jpg" || format == "heif" || format == "heic" || format == "jpeg2000" || format == "jp2") {
            double compressionQuality = (options_.quality >= 0.0) ? options_.quality : 0.9; // Default to 0.9 if not specified
            properties[(__bridge NSString*)kCGImageDestinationLossyCompressionQuality] = @(compressionQuality);
        }
        
        // Set thumbnail embedding for JPEG and HEIF formats
        if ((format == "jpeg" || format == "jpg" || format == "heif" || format == "heic") && options_.embedThumbnail) {
            properties[(__bridge NSString*)kCGImageDestinationEmbedThumbnail] = @YES;
        }
        
        // Set optimize color for sharing for all formats
        if (options_.optimizeColorForSharing) {
            properties[(__bridge NSString*)kCGImageDestinationOptimizeColorForSharing] = @YES;
        }
        
        // Merge source metadata if preservation is requested
        if (options_.preserveExifData && sourceMetadata) {
            NSMutableDictionary* mergedProperties = [NSMutableDictionary dictionaryWithDictionary:sourceMetadata];
            
            // Merge the format-specific properties
            [mergedProperties addEntriesFromDictionary:properties];
            
            // Use the kCGImageDestinationMergeMetadata option to preserve metadata
            mergedProperties[(__bridge NSString*)kCGImageDestinationMergeMetadata] = @YES;
            
            CGImageDestinationAddImage(destination, cgImage, (__bridge CFDictionaryRef)mergedProperties);
        } else {
            CGImageDestinationAddImage(destination, cgImage, (__bridge CFDictionaryRef)properties);
        }
        
        if (!CGImageDestinationFinalize(destination)) {
            CFRelease(destination);
            CGImageRelease(cgImage);
            CGColorSpaceRelease(colorSpace);
            SetErrorMessage("Failed to finalize image destination");
            return;
        }
        
        // Store output data for callback
        outputLength_ = [outputData length];
        outputData_ = new char[outputLength_];
        memcpy(outputData_, [outputData bytes], outputLength_);
        
        // Cleanup
        CFRelease(destination);
        CGImageRelease(cgImage);
        CGColorSpaceRelease(colorSpace);
        if (sourceMetadataRef) {
            CFRelease(sourceMetadataRef);
        }
    }
}

void ConvertRawAsyncWorker::HandleOKCallback() {
    Nan::HandleScope scope;
    
    // Always return an OutputImage object with buffer and optional metadata
    Local<Object> outputImage = Nan::New<Object>();
    Nan::Set(outputImage, Nan::New("buffer").ToLocalChecked(), Nan::CopyBuffer(outputData_, outputLength_).ToLocalChecked());
    
    // Add metadata if it was extracted
    if (metadataStorage_.hasMetadata) {
        Local<Object> metadata = Nan::New<Object>();
        
        if (metadataStorage_.width > 0) {
            Nan::Set(metadata, Nan::New("width").ToLocalChecked(), Nan::New<Number>(metadataStorage_.width));
        }
        if (metadataStorage_.height > 0) {
            Nan::Set(metadata, Nan::New("height").ToLocalChecked(), Nan::New<Number>(metadataStorage_.height));
        }
        if (metadataStorage_.focalLength35mm >= 0) {
            Nan::Set(metadata, Nan::New("focalLength35mm").ToLocalChecked(), Nan::New<Number>(metadataStorage_.focalLength35mm));
        }
        if (metadataStorage_.shutterSpeed >= 0) {
            Nan::Set(metadata, Nan::New("shutterSpeed").ToLocalChecked(), Nan::New<Number>(metadataStorage_.shutterSpeed));
        }
        if (metadataStorage_.fNumber >= 0) {
            Nan::Set(metadata, Nan::New("fNumber").ToLocalChecked(), Nan::New<Number>(metadataStorage_.fNumber));
        }
        if (!metadataStorage_.cameraMake.empty()) {
            Nan::Set(metadata, Nan::New("cameraMake").ToLocalChecked(), Nan::New<String>(metadataStorage_.cameraMake).ToLocalChecked());
        }
        if (!metadataStorage_.cameraModel.empty()) {
            Nan::Set(metadata, Nan::New("cameraModel").ToLocalChecked(), Nan::New<String>(metadataStorage_.cameraModel).ToLocalChecked());
        }
        if (metadataStorage_.iso >= 0) {
            Nan::Set(metadata, Nan::New("iso").ToLocalChecked(), Nan::New<Number>(metadataStorage_.iso));
        }
        if (!metadataStorage_.dateTimeOriginal.empty()) {
            Nan::Set(metadata, Nan::New("dateTimeOriginal").ToLocalChecked(), Nan::New<String>(metadataStorage_.dateTimeOriginal).ToLocalChecked());
        }
        if (!metadataStorage_.lensMake.empty()) {
            Nan::Set(metadata, Nan::New("lensMake").ToLocalChecked(), Nan::New<String>(metadataStorage_.lensMake).ToLocalChecked());
        }
        if (!metadataStorage_.lensModel.empty()) {
            Nan::Set(metadata, Nan::New("lensModel").ToLocalChecked(), Nan::New<String>(metadataStorage_.lensModel).ToLocalChecked());
        }
        if (metadataStorage_.focalLength >= 0) {
            Nan::Set(metadata, Nan::New("focalLength").ToLocalChecked(), Nan::New<Number>(metadataStorage_.focalLength));
        }
        if (metadataStorage_.whiteBalance >= 0) {
            Nan::Set(metadata, Nan::New("whiteBalance").ToLocalChecked(), Nan::New<Number>(metadataStorage_.whiteBalance));
        }
        if (metadataStorage_.exposureMode >= 0) {
            Nan::Set(metadata, Nan::New("exposureMode").ToLocalChecked(), Nan::New<Number>(metadataStorage_.exposureMode));
        }
        if (metadataStorage_.exposureBias > -999) {
            Nan::Set(metadata, Nan::New("exposureBias").ToLocalChecked(), Nan::New<Number>(metadataStorage_.exposureBias));
        }
        if (!metadataStorage_.software.empty()) {
            Nan::Set(metadata, Nan::New("software").ToLocalChecked(), Nan::New<String>(metadataStorage_.software).ToLocalChecked());
        }
        if (metadataStorage_.orientation >= 0) {
            Nan::Set(metadata, Nan::New("orientation").ToLocalChecked(), Nan::New<Number>(metadataStorage_.orientation));
        }
        if (metadataStorage_.latitude > -999) {
            Nan::Set(metadata, Nan::New("latitude").ToLocalChecked(), Nan::New<Number>(metadataStorage_.latitude));
        }
        if (metadataStorage_.longitude > -999) {
            Nan::Set(metadata, Nan::New("longitude").ToLocalChecked(), Nan::New<Number>(metadataStorage_.longitude));
        }
        if (metadataStorage_.altitude > -999) {
            Nan::Set(metadata, Nan::New("altitude").ToLocalChecked(), Nan::New<Number>(metadataStorage_.altitude));
        }

        Nan::Set(outputImage, Nan::New("metadata").ToLocalChecked(), metadata);
    }
    
    Local<Value> argv[] = {
        Nan::Null(),
        outputImage
    };
    
    callback->Call(2, argv, async_resource);
}

void ConvertRawAsyncWorker::HandleErrorCallback() {
    Nan::HandleScope scope;
    
    Local<Value> argv[] = {
        Nan::Error(ErrorMessage()),
        Nan::Null()
    };
    
    callback->Call(2, argv, async_resource);
}

NAN_METHOD(ConvertRaw) {
    if (info.Length() < 1) {
        Nan::ThrowTypeError("First argument must be a Buffer or file path string");
        return;
    }
    
    if (info.Length() < 2 || !info[1]->IsString()) {
        Nan::ThrowTypeError("Second argument must be a string specifying the output format");
        return;
    }
    
    // Get the output format
    Nan::Utf8String outputFormat(info[1]);
    std::string format = std::string(*outputFormat);
    
    // Parse options if provided
    // Default values
    bool enableLensCorrection = true;
    double exposureValue = 0.0;
    double boostValue = 1.0;
    double boostShadowAmount = 0.0;
    double baselineExposure = 0.0;
    double neutralTemperature = -1.0; // -1 means use default
    double neutralTint = -1.0; // -1 means use default
    bool disableGamutMap = false;
    bool allowDraftMode = false;
    bool ignoreImageOrientation = false;
    
    // New options
    double colorNoiseReductionAmount = -1.0; // -1 means use default
    double luminanceNoiseReductionAmount = -1.0; // -1 means use default
    double contrastAmount = -1.0; // -1 means use default
    double sharpnessAmount = -1.0; // -1 means use default
    double noiseReductionAmount = -1.0; // -1 means use default
    double localToneMapAmount = -1.0; // -1 means use default
    double scaleFactor = 1.0; // Default to 1.0 (no scaling)
    
    // Quality options
    double quality = -1.0; // -1 means use default (0.9 for lossy formats)
    bool embedThumbnail = false;
    bool optimizeColorForSharing = false;
    bool preserveExifData = true; // Default to true to preserve metadata
    bool extractMetadata = false;
    std::string inputFormat;
    
    if (info.Length() >= 3 && info[2]->IsObject()) {
        Local<Object> options = info[2].As<Object>();
        
        // Helper lambda to extract boolean option
        auto getBoolOption = [&](const char* key, bool& target) {
            Local<String> keyStr = Nan::New(key).ToLocalChecked();
            if (Nan::Has(options, keyStr).FromJust()) {
                Local<Value> value = Nan::Get(options, keyStr).ToLocalChecked();
                if (value->IsBoolean()) {
                    target = Nan::To<bool>(value).FromJust();
                }
            }
        };
        
        // Helper lambda to extract number option
        auto getNumberOption = [&](const char* key, double& target) {
            Local<String> keyStr = Nan::New(key).ToLocalChecked();
            if (Nan::Has(options, keyStr).FromJust()) {
                Local<Value> value = Nan::Get(options, keyStr).ToLocalChecked();
                if (value->IsNumber()) {
                    target = Nan::To<double>(value).FromJust();
                }
            }
        };
        
        // Helper lambda to extract string option
        auto getStringOption = [&](const char* key, std::string& target) {
            Local<String> keyStr = Nan::New(key).ToLocalChecked();
            if (Nan::Has(options, keyStr).FromJust()) {
                Local<Value> value = Nan::Get(options, keyStr).ToLocalChecked();
                if (value->IsString()) {
                    Nan::Utf8String str(value);
                    target = std::string(*str);
                }
            }
        };
        
        // Extract all options
        getBoolOption("lensCorrection", enableLensCorrection);
        getNumberOption("exposure", exposureValue);
        getNumberOption("boost", boostValue);
        getNumberOption("boostShadowAmount", boostShadowAmount);
        getNumberOption("baselineExposure", baselineExposure);
        getNumberOption("neutralTemperature", neutralTemperature);
        getNumberOption("neutralTint", neutralTint);
        getBoolOption("disableGamutMap", disableGamutMap);
        getBoolOption("allowDraftMode", allowDraftMode);
        getBoolOption("ignoreImageOrientation", ignoreImageOrientation);
        
        // Extract new options
        getNumberOption("colorNoiseReductionAmount", colorNoiseReductionAmount);
        getNumberOption("luminanceNoiseReductionAmount", luminanceNoiseReductionAmount);
        getNumberOption("contrastAmount", contrastAmount);
        getNumberOption("sharpnessAmount", sharpnessAmount);
        getNumberOption("noiseReductionAmount", noiseReductionAmount);
        getNumberOption("localToneMapAmount", localToneMapAmount);
        getNumberOption("scaleFactor", scaleFactor);
        
        // Extract quality options
        getNumberOption("quality", quality);
        getBoolOption("embedThumbnail", embedThumbnail);
        getBoolOption("optimizeColorForSharing", optimizeColorForSharing);
        getBoolOption("preserveExifData", preserveExifData);
        getBoolOption("extractMetadata", extractMetadata);
        getStringOption("inputFormat", inputFormat);
    }
    
    // Determine input type and get NSData
    NSData* imageData = nil;
    
    @autoreleasepool {
        if (info[0]->IsString()) {
            // File path input
            Nan::Utf8String pathStr(info[0]);
            std::string filePath = std::string(*pathStr);
            
            if (filePath.empty()) {
                Nan::ThrowError("File path cannot be empty");
                return;
            }
            
            NSString* nsFilePath = [NSString stringWithUTF8String:filePath.c_str()];
            imageData = [NSData dataWithContentsOfFile:nsFilePath];
            
            if (!imageData) {
                Nan::ThrowError("Failed to read file from path");
                return;
            }
        } else if (node::Buffer::HasInstance(info[0])) {
            // Buffer input
            Local<Object> bufferObj = info[0].As<Object>();
            char* rawData = node::Buffer::Data(bufferObj);
            size_t rawDataLength = node::Buffer::Length(bufferObj);
            
            if (rawDataLength == 0) {
                Nan::ThrowError("Input buffer is empty");
                return;
            }
            
            imageData = [NSData dataWithBytes:rawData length:rawDataLength];
        } else {
            Nan::ThrowTypeError("First argument must be a Buffer or file path string");
            return;
        }
        
        // Write data to a temporary file because CIRAWFilter works better with file URLs
        NSString* tempPath = [NSTemporaryDirectory() stringByAppendingPathComponent:[[NSUUID UUID] UUIDString]];
        // Use inputFormat if specified, otherwise use original file extension
        NSString* fileExtension = nil;
        if (!inputFormat.empty()) {
            // inputFormat takes precedence
            fileExtension = [NSString stringWithUTF8String:inputFormat.c_str()];
        } else if (info[0]->IsString()) {
            // Fall back to original file extension
            Nan::Utf8String pathStr(info[0]);
            NSString* originalPath = [NSString stringWithUTF8String:*pathStr];
            NSString* originalExt = [originalPath pathExtension];
            if ([originalExt length] > 0) {
                fileExtension = originalExt;
            }
        }
        
        // Only append extension if we have one
        if (fileExtension && [fileExtension length] > 0) {
            tempPath = [tempPath stringByAppendingPathExtension:fileExtension];
        }
        
        NSError* writeError = nil;
        BOOL written = [imageData writeToFile:tempPath options:NSDataWritingAtomic error:&writeError];
        
        if (!written) {
            NSString* errorMsg = [NSString stringWithFormat:@"Failed to write temp file: %@", writeError.localizedDescription];
            Nan::ThrowError([errorMsg UTF8String]);
            return;
        }
        
        // Create URL for the temp file
        NSURL* fileURL = [NSURL fileURLWithPath:tempPath];
        
        // Read metadata from source if preservation is requested
        NSDictionary* sourceMetadata = nil;
        CFDictionaryRef sourceMetadataRef = NULL;
        if (preserveExifData) {
            CGImageSourceRef imageSource = CGImageSourceCreateWithURL((__bridge CFURLRef)fileURL, NULL);
            if (imageSource) {
                sourceMetadataRef = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, NULL);
                sourceMetadata = (__bridge NSDictionary*)sourceMetadataRef;
                CFRelease(imageSource);
            }
        }
        
        // Create RAW filter options
        NSMutableDictionary* rawOptions = [NSMutableDictionary dictionary];
        
        // Basic options
        rawOptions[kCIInputEnableVendorLensCorrectionKey] = enableLensCorrection ? @YES : @NO;
        rawOptions[kCIInputBoostKey] = @(boostValue);
        
        // Exposure options
        rawOptions[kCIInputEVKey] = @(exposureValue);
        if (baselineExposure != 0.0) {
            rawOptions[kCIInputBaselineExposureKey] = @(baselineExposure);
        }
        if (boostShadowAmount != 0.0) {
            rawOptions[kCIInputBoostShadowAmountKey] = @(boostShadowAmount);
        }
        
        // Color options
        if (neutralTemperature >= 0) {
            rawOptions[kCIInputNeutralTemperatureKey] = @(neutralTemperature);
        }
        if (neutralTint >= 0) {
            rawOptions[kCIInputNeutralTintKey] = @(neutralTint);
        }
        
        // Other options
        if (disableGamutMap) {
            rawOptions[kCIInputDisableGamutMapKey] = @YES;
        }
        if (allowDraftMode) {
            rawOptions[kCIInputAllowDraftModeKey] = @YES;
        }
        if (ignoreImageOrientation) {
            rawOptions[kCIInputIgnoreImageOrientationKey] = @YES;
        }
        
        // Noise reduction options
        if (colorNoiseReductionAmount >= 0) {
            rawOptions[kCIInputColorNoiseReductionAmountKey] = @(colorNoiseReductionAmount);
        }
        if (luminanceNoiseReductionAmount >= 0) {
            rawOptions[kCIInputLuminanceNoiseReductionAmountKey] = @(luminanceNoiseReductionAmount);
        }
        
        // Enhancement options
        if (contrastAmount >= 0) {
            rawOptions[kCIInputContrastKey] = @(contrastAmount);
        }
        if (sharpnessAmount >= 0) {
            rawOptions[kCIInputSharpnessKey] = @(sharpnessAmount);
        }
        
        // Additional processing options
        if (noiseReductionAmount >= 0) {
            rawOptions[kCIInputNoiseReductionAmountKey] = @(noiseReductionAmount);
        }
        
        if (@available(macOS 11.1, *)) {
            if (localToneMapAmount >= 0) {
                rawOptions[kCIInputLocalToneMapAmountKey] = @(localToneMapAmount);
            }
        }
        
        if (scaleFactor != 1.0) {
            rawOptions[kCIInputScaleFactorKey] = @(scaleFactor);
        }
        
        if (@available(macOS 10.14, *)) {
            rawOptions[kCIInputEnableEDRModeKey] = @NO;
        }
        
        // Create CIFilter from file URL
        CIFilter* rawFilter = [CIFilter filterWithImageURL:fileURL options:rawOptions];
        
        // Clean up temp file
        [[NSFileManager defaultManager] removeItemAtPath:tempPath error:nil];
        
        if (!rawFilter) {
            Nan::ThrowError("Failed to create CIRAWFilter from image data");
            return;
        }
        
        // Get the output image
        CIImage* outputImage = rawFilter.outputImage;
        
        if (!outputImage) {
            Nan::ThrowError("Failed to get output image from RAW filter");
            return;
        }
        
        // Create CIContext for rendering
        CIContext* context = [CIContext context];
        
        // Get the image extent
        CGRect extent = [outputImage extent];
        
        if (CGRectIsEmpty(extent)) {
            Nan::ThrowError("Output image has empty extent");
            return;
        }
        
        // Create a color space
        CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
        
        // Render CIImage to CGImage
        CGImageRef cgImage = [context createCGImage:outputImage fromRect:extent];
        
        if (!cgImage) {
            CGColorSpaceRelease(colorSpace);
            Nan::ThrowError("Failed to create CGImage from CIImage");
            return;
        }
        
        // Extract metadata if requested (for all formats)
        Local<Object> metadata;
        if (extractMetadata) {
            metadata = ExtractImageMetadata(sourceMetadataRef, cgImage);
        }
        
        // Handle RGB format separately (raw bitmap data)
        if (format == "rgb") {
            char* rgbData = nullptr;
            size_t rgbLength = 0;
            
            if (ExtractRgbData(cgImage, colorSpace, &rgbData, &rgbLength)) {
                // Create OutputImage object
                Local<Object> rgbResult = Nan::New<Object>();
                Nan::Set(rgbResult, Nan::New("buffer").ToLocalChecked(), Nan::CopyBuffer(rgbData, rgbLength).ToLocalChecked());
                
                // Add metadata if extracted
                if (extractMetadata) {
                    Nan::Set(rgbResult, Nan::New("metadata").ToLocalChecked(), metadata);
                }
                
                delete[] rgbData;
                CGColorSpaceRelease(colorSpace);
                CGImageRelease(cgImage);
                if (sourceMetadataRef) {
                    CFRelease(sourceMetadataRef);
                }
                
                info.GetReturnValue().Set(rgbResult);
                return;
            } else {
                CGColorSpaceRelease(colorSpace);
                CGImageRelease(cgImage);
                if (sourceMetadataRef) {
                    CFRelease(sourceMetadataRef);
                }
                Nan::ThrowError("Failed to extract RGB data from image");
                return;
            }
        }
        
        // Determine the UTI for the output format
        CFStringRef outputUTI;
        if (format == "jpeg" || format == "jpg") {
            outputUTI = CFSTR("public.jpeg");
        } else if (format == "png") {
            outputUTI = CFSTR("public.png");
        } else if (format == "tiff" || format == "tif") {
            outputUTI = CFSTR("public.tiff");
        } else if (format == "jpeg2000" || format == "jp2") {
            outputUTI = CFSTR("public.jpeg-2000");
        } else if (format == "heif" || format == "heic") {
            outputUTI = CFSTR("public.heic");
        } else {
            CGColorSpaceRelease(colorSpace);
            std::string errorMsg = "Unsupported output format: " + format + ". Supported formats: jpeg, jpg, png, tiff, tif, jpeg2000, jp2, heif, heic, rgb";
            Nan::ThrowError(errorMsg.c_str());
            return;
        }
        
        // Create output data
        NSMutableData* outputData = [NSMutableData data];
        CGImageDestinationRef destination = CGImageDestinationCreateWithData(
            (__bridge CFMutableDataRef)outputData,
            outputUTI,
            1,
            NULL
        );
        
        if (!destination) {
            CGImageRelease(cgImage);
            CGColorSpaceRelease(colorSpace);
            Nan::ThrowError("Failed to create image destination");
            return;
        }
        
        // Set format-specific properties
        NSMutableDictionary* properties = [NSMutableDictionary dictionary];
        
        // Set compression quality for lossy formats
        if (format == "jpeg" || format == "jpg" || format == "heif" || format == "heic" || format == "jpeg2000" || format == "jp2") {
            double compressionQuality = (quality >= 0.0) ? quality : 0.9; // Default to 0.9 if not specified
            properties[(__bridge NSString*)kCGImageDestinationLossyCompressionQuality] = @(compressionQuality);
        }
        
        // Set thumbnail embedding for JPEG and HEIF formats
        if ((format == "jpeg" || format == "jpg" || format == "heif" || format == "heic") && embedThumbnail) {
            properties[(__bridge NSString*)kCGImageDestinationEmbedThumbnail] = @YES;
        }
        
        // Set optimize color for sharing for all formats
        if (optimizeColorForSharing) {
            properties[(__bridge NSString*)kCGImageDestinationOptimizeColorForSharing] = @YES;
        }
        
        // Merge source metadata if preservation is requested
        if (preserveExifData && sourceMetadata) {
            NSMutableDictionary* mergedProperties = [NSMutableDictionary dictionaryWithDictionary:sourceMetadata];
            
            // Merge the format-specific properties
            [mergedProperties addEntriesFromDictionary:properties];
            
            // Use the kCGImageDestinationMergeMetadata option to preserve metadata
            mergedProperties[(__bridge NSString*)kCGImageDestinationMergeMetadata] = @YES;
            
            CGImageDestinationAddImage(destination, cgImage, (__bridge CFDictionaryRef)mergedProperties);
        } else {
            CGImageDestinationAddImage(destination, cgImage, (__bridge CFDictionaryRef)properties);
        }
        
        if (!CGImageDestinationFinalize(destination)) {
            CFRelease(destination);
            CGImageRelease(cgImage);
            CGColorSpaceRelease(colorSpace);
            Nan::ThrowError("Failed to finalize image destination");
            return;
        }
        
        // Create OutputImage object with buffer and optional metadata
        Local<Object> result = Nan::New<Object>();
        Nan::Set(result, Nan::New("buffer").ToLocalChecked(),
                Nan::CopyBuffer((const char*)[outputData bytes], [outputData length]).ToLocalChecked());
        
        // Add metadata if extracted
        if (extractMetadata) {
            Nan::Set(result, Nan::New("metadata").ToLocalChecked(), metadata);
        }
        
        // Cleanup
        CFRelease(destination);
        CGImageRelease(cgImage);
        CGColorSpaceRelease(colorSpace);
        if (sourceMetadataRef) {
            CFRelease(sourceMetadataRef);
        }
        
        // Return the OutputImage object
        info.GetReturnValue().Set(result);
    }
}

NAN_METHOD(ConvertRawAsync) {
    if (info.Length() < 4) {
        Nan::ThrowTypeError("ConvertRawAsync requires 4 arguments: input, format, options, callback");
        return;
    }
    
    // Check callback is function
    if (!info[3]->IsFunction()) {
        Nan::ThrowTypeError("Fourth argument must be a callback function");
        return;
    }
    
    Nan::Callback *callback = new Nan::Callback(info[3].As<Function>());
    
    // Determine input type (Buffer or string)
    bool isFilePath = false;
    std::string filePath;
    char* bufferData = nullptr;
    size_t bufferLength = 0;
    
    if (info[0]->IsString()) {
        // File path input
        isFilePath = true;
        Nan::Utf8String pathStr(info[0]);
        filePath = std::string(*pathStr);
        
        if (filePath.empty()) {
            delete callback;
            Nan::ThrowError("File path cannot be empty");
            return;
        }
    } else if (node::Buffer::HasInstance(info[0])) {
        // Buffer input
        isFilePath = false;
        Local<Object> bufferObj = info[0].As<Object>();
        bufferData = node::Buffer::Data(bufferObj);
        bufferLength = node::Buffer::Length(bufferObj);
        
        if (bufferLength == 0) {
            delete callback;
            Nan::ThrowError("Input buffer is empty");
            return;
        }
    } else {
        delete callback;
        Nan::ThrowTypeError("First argument must be a Buffer or file path string");
        return;
    }
    
    // Get format
    if (!info[1]->IsString()) {
        delete callback;
        Nan::ThrowTypeError("Second argument must be a string specifying the output format");
        return;
    }
    
    Nan::Utf8String outputFormat(info[1]);
    std::string format = std::string(*outputFormat);
    
    // Parse options (same as sync version)
    InternalConversionOptions options;
    
    if (info[2]->IsObject()) {
        Local<Object> optionsObj = info[2].As<Object>();
        
        // Helper lambda to extract boolean option
        auto getBoolOption = [&](const char* key, bool& target) {
            Local<String> keyStr = Nan::New(key).ToLocalChecked();
            if (Nan::Has(optionsObj, keyStr).FromJust()) {
                Local<Value> value = Nan::Get(optionsObj, keyStr).ToLocalChecked();
                if (value->IsBoolean()) {
                    target = Nan::To<bool>(value).FromJust();
                }
            }
        };
        
        // Helper lambda to extract number option
        auto getNumberOption = [&](const char* key, double& target) {
            Local<String> keyStr = Nan::New(key).ToLocalChecked();
            if (Nan::Has(optionsObj, keyStr).FromJust()) {
                Local<Value> value = Nan::Get(optionsObj, keyStr).ToLocalChecked();
                if (value->IsNumber()) {
                    target = Nan::To<double>(value).FromJust();
                }
            }
        };
        
        // Helper lambda to extract string option
        auto getStringOption = [&](const char* key, std::string& target) {
            Local<String> keyStr = Nan::New(key).ToLocalChecked();
            if (Nan::Has(optionsObj, keyStr).FromJust()) {
                Local<Value> value = Nan::Get(optionsObj, keyStr).ToLocalChecked();
                if (value->IsString()) {
                    Nan::Utf8String str(value);
                    target = std::string(*str);
                }
            }
        };
        
        // Extract all options
        getBoolOption("lensCorrection", options.lensCorrection);
        getNumberOption("exposure", options.exposure);
        getNumberOption("boost", options.boost);
        getNumberOption("boostShadowAmount", options.boostShadowAmount);
        getNumberOption("baselineExposure", options.baselineExposure);
        getNumberOption("neutralTemperature", options.neutralTemperature);
        getNumberOption("neutralTint", options.neutralTint);
        getBoolOption("disableGamutMap", options.disableGamutMap);
        getBoolOption("allowDraftMode", options.allowDraftMode);
        getBoolOption("ignoreImageOrientation", options.ignoreImageOrientation);
        
        // Extract new options
        getNumberOption("colorNoiseReductionAmount", options.colorNoiseReductionAmount);
        getNumberOption("luminanceNoiseReductionAmount", options.luminanceNoiseReductionAmount);
        getNumberOption("contrastAmount", options.contrastAmount);
        getNumberOption("sharpnessAmount", options.sharpnessAmount);
        getNumberOption("noiseReductionAmount", options.noiseReductionAmount);
        getNumberOption("localToneMapAmount", options.localToneMapAmount);
        getNumberOption("scaleFactor", options.scaleFactor);
        
        // Extract quality options
        getNumberOption("quality", options.quality);
        getBoolOption("embedThumbnail", options.embedThumbnail);
        getBoolOption("optimizeColorForSharing", options.optimizeColorForSharing);
        getBoolOption("preserveExifData", options.preserveExifData);
        getBoolOption("extractMetadata", options.extractMetadata);
        getStringOption("inputFormat", options.inputFormat);
    }
    
    // Create and queue the async worker
    ConvertRawAsyncWorker* worker = new ConvertRawAsyncWorker(
        callback, isFilePath, filePath, bufferData, bufferLength, format, options
    );
    
    Nan::AsyncQueueWorker(worker);
}

NAN_MODULE_INIT(Init) {
    Nan::Set(target, Nan::New("convertRaw").ToLocalChecked(),
        Nan::GetFunction(Nan::New<FunctionTemplate>(ConvertRaw)).ToLocalChecked());
    Nan::Set(target, Nan::New("convertRawAsync").ToLocalChecked(),
        Nan::GetFunction(Nan::New<FunctionTemplate>(ConvertRawAsync)).ToLocalChecked());
}

NODE_MODULE(raw_converter, Init)