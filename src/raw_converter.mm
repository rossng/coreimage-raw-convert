#import <nan.h>
#import <CoreImage/CoreImage.h>
#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>
#import <AppKit/AppKit.h>
#include <string>

using namespace v8;

NAN_METHOD(ConvertRaw) {
    if (info.Length() < 1 || !node::Buffer::HasInstance(info[0])) {
        Nan::ThrowTypeError("First argument must be a Buffer containing RAW image data");
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
    }
    
    Local<Object> bufferObj = info[0].As<Object>();
    char* rawData = node::Buffer::Data(bufferObj);
    size_t rawDataLength = node::Buffer::Length(bufferObj);
    
    @autoreleasepool {
        NSData* imageData = [NSData dataWithBytes:rawData length:rawDataLength];
        
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
        if (format == "jpeg" || format == "jpg" || format == "heif" || format == "heic") {
            properties[(__bridge NSString*)kCGImageDestinationLossyCompressionQuality] = @0.9;
        }
        
        CGImageDestinationAddImage(destination, cgImage, (__bridge CFDictionaryRef)properties);
        
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

NAN_MODULE_INIT(Init) {
    Nan::Set(target, Nan::New("convertRaw").ToLocalChecked(),
        Nan::GetFunction(Nan::New<FunctionTemplate>(ConvertRaw)).ToLocalChecked());
}

NODE_MODULE(raw_converter, Init)