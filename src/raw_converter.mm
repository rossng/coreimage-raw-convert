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
};

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
        tempPath = [tempPath stringByAppendingPathExtension:@"arw"];
        
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
        if (options_.preserveExifData) {
            CGImageSourceRef imageSource = CGImageSourceCreateWithURL((__bridge CFURLRef)fileURL, NULL);
            if (imageSource) {
                sourceMetadata = (__bridge NSDictionary*)CGImageSourceCopyPropertiesAtIndex(imageSource, 0, NULL);
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
        
        // Determine the UTI for the output format
        CFStringRef outputUTI;
        std::string format = format_;
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
            std::string errorMsg = "Unsupported output format: " + format + ". Supported formats: jpeg, jpg, png, tiff, tif, jpeg2000, jp2, heif, heic";
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
    }
}

void ConvertRawAsyncWorker::HandleOKCallback() {
    Nan::HandleScope scope;
    
    Local<Value> argv[] = {
        Nan::Null(),
        Nan::CopyBuffer(outputData_, outputLength_).ToLocalChecked()
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
        tempPath = [tempPath stringByAppendingPathExtension:@"arw"];
        
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
        if (preserveExifData) {
            CGImageSourceRef imageSource = CGImageSourceCreateWithURL((__bridge CFURLRef)fileURL, NULL);
            if (imageSource) {
                sourceMetadata = (__bridge NSDictionary*)CGImageSourceCopyPropertiesAtIndex(imageSource, 0, NULL);
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
            std::string errorMsg = "Unsupported output format: " + format + ". Supported formats: jpeg, jpg, png, tiff, tif, jpeg2000, jp2, heif, heic";
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
        
        // Cleanup
        CFRelease(destination);
        CGImageRelease(cgImage);
        CGColorSpaceRelease(colorSpace);
        
        // Return the output data as a Node.js Buffer
        info.GetReturnValue().Set(
            Nan::CopyBuffer((const char*)[outputData bytes], [outputData length]).ToLocalChecked()
        );
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