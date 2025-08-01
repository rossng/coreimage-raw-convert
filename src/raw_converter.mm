#import <nan.h>
#import <CoreImage/CoreImage.h>
#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>
#import <AppKit/AppKit.h>

using namespace v8;

NAN_METHOD(ConvertRawToJpeg) {
    if (info.Length() < 1 || !node::Buffer::HasInstance(info[0])) {
        Nan::ThrowTypeError("First argument must be a Buffer containing RAW image data");
        return;
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
        rawOptions[kCIInputEnableVendorLensCorrectionKey] = @YES;
        rawOptions[kCIInputBoostKey] = @1.0;
        
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
        
        // Create JPEG data
        NSMutableData* jpegData = [NSMutableData data];
        CGImageDestinationRef destination = CGImageDestinationCreateWithData(
            (__bridge CFMutableDataRef)jpegData,
            CFSTR("public.jpeg"),
            1,
            NULL
        );
        
        if (!destination) {
            CGImageRelease(cgImage);
            CGColorSpaceRelease(colorSpace);
            Nan::ThrowError("Failed to create image destination");
            return;
        }
        
        // Set JPEG compression quality
        NSDictionary* properties = @{
            (__bridge NSString*)kCGImageDestinationLossyCompressionQuality: @0.9
        };
        
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
        
        // Return the JPEG data as a Node.js Buffer
        info.GetReturnValue().Set(
            Nan::CopyBuffer((const char*)[jpegData bytes], [jpegData length]).ToLocalChecked()
        );
    }
}

NAN_MODULE_INIT(Init) {
    Nan::Set(target, Nan::New("convertRawToJpeg").ToLocalChecked(),
        Nan::GetFunction(Nan::New<FunctionTemplate>(ConvertRawToJpeg)).ToLocalChecked());
}

NODE_MODULE(raw_converter, Init)