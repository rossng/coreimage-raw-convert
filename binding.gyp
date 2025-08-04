{
  "targets": [
    {
      "target_name": "raw_converter",
      "sources": [ "src/raw_converter.mm" ],
      "include_dirs": [
        "<!(node -e \"require('nan')\")"
      ],
      "xcode_settings": {
        "OTHER_LDFLAGS": ["-framework CoreImage", "-framework Foundation", "-framework CoreGraphics", "-framework ImageIO", "-framework AppKit"],
        "MACOSX_DEPLOYMENT_TARGET": "10.11",
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES"
      },
      "conditions": [
        ['OS=="mac"', {
          "sources": [ "src/raw_converter.mm" ]
        }]
      ]
    }
  ]
}