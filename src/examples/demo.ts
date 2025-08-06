import express, { Request, Response } from 'express';
import {
  convertRaw,
  type ConversionOptions,
  type OutputFormat,
} from '../index.js';
import { loadSampleImage } from './load-image.js';

const app = express();
const PORT = 3000;

interface ConvertRequest extends Request {
  body: ConversionOptions & {
    format?: OutputFormat;
  };
}

interface ContentTypeMap {
  [key: string]: string;
}

app.use(express.json());
app.use(express.static('public'));

// No longer storing converted image - always convert fresh

// Serve the HTML page
app.get('/', (_: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CoreImage RAW Converter Demo</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      display: flex;
      gap: 20px;
    }
    .controls {
      flex: 0 0 350px;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .image-container {
      flex: 1;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    }
    h1 {
      color: #333;
      margin-bottom: 30px;
    }
    .control-group {
      margin-bottom: 15px;
    }
    .control-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
      color: #555;
    }
    .control-group input[type="number"] {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
    }
    .control-group input[type="checkbox"] {
      margin-right: 8px;
    }
    .checkbox-label {
      font-weight: normal;
    }
    button {
      background-color: #007bff;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
      width: 100%;
      margin: 20px 0 10px 0;
    }
    button:hover {
      background-color: #0056b3;
    }
    button:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }
    #image {
      max-width: 100%;
      height: auto;
      display: none;
    }
    #status {
      margin: 10px 0;
      padding: 10px;
      border-radius: 4px;
      display: none;
    }
    .success {
      background-color: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .error {
      background-color: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .info {
      background-color: #d1ecf1;
      color: #0c5460;
      border: 1px solid #bee5eb;
    }
    .slider-container {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .slider-container input[type="range"] {
      flex: 1;
    }
    .slider-value {
      min-width: 50px;
      text-align: right;
    }
  </style>
</head>
<body>
  <h1>CoreImage RAW Converter Demo</h1>
  <div class="container">
    <div class="controls">
      <h2>Conversion Options</h2>
      
      <div class="control-group">
        <label>
          <input type="checkbox" id="lensCorrection" checked>
          <span class="checkbox-label">Enable Lens Correction</span>
        </label>
      </div>
      
      <div class="control-group">
        <label>
          <input type="checkbox" id="disableGamutMap">
          <span class="checkbox-label">Disable Gamut Mapping</span>
        </label>
      </div>
      
      <div class="control-group">
        <label>
          <input type="checkbox" id="allowDraftMode">
          <span class="checkbox-label">Allow Draft Mode (faster)</span>
        </label>
      </div>
      
      <div class="control-group">
        <label>
          <input type="checkbox" id="ignoreImageOrientation">
          <span class="checkbox-label">Ignore Image Orientation</span>
        </label>
      </div>
      
      <div class="control-group">
        <label>
          <input type="checkbox" id="preserveExifData" checked>
          <span class="checkbox-label">Preserve EXIF Metadata</span>
        </label>
      </div>
      
      <div class="control-group">
        <label for="exposure">Exposure (EV stops)</label>
        <div class="slider-container">
          <input type="range" id="exposure" min="-3" max="3" step="0.1" value="0">
          <span class="slider-value" id="exposureValue">0.0</span>
        </div>
      </div>
      
      <div class="control-group">
        <label for="boost">Boost (0.0-1.0)</label>
        <div class="slider-container">
          <input type="range" id="boost" min="0" max="1" step="0.1" value="1">
          <span class="slider-value" id="boostValue">1.0</span>
        </div>
      </div>
      
      <div class="control-group">
        <label for="boostShadowAmount">Boost Shadow Amount</label>
        <div class="slider-container">
          <input type="range" id="boostShadowAmount" min="0" max="1" step="0.1" value="0">
          <span class="slider-value" id="boostShadowAmountValue">0.0</span>
        </div>
      </div>
      
      <div class="control-group">
        <label for="baselineExposure">Baseline Exposure</label>
        <div class="slider-container">
          <input type="range" id="baselineExposure" min="-3" max="3" step="0.1" value="0">
          <span class="slider-value" id="baselineExposureValue">0.0</span>
        </div>
      </div>
      
      <div class="control-group">
        <label for="neutralTemperature">Color Temperature (K)</label>
        <input type="number" id="neutralTemperature" min="2000" max="10000" step="100" placeholder="Auto">
      </div>
      
      <div class="control-group">
        <label for="neutralTint">Tint</label>
        <input type="number" id="neutralTint" min="-100" max="100" step="1" placeholder="Auto">
      </div>
      
      <div class="control-group">
        <label for="colorNoiseReductionAmount">Color Noise Reduction (0.0-1.0)</label>
        <div class="slider-container">
          <input type="range" id="colorNoiseReductionAmount" min="0" max="1" step="0.1" value="0.5">
          <span class="slider-value" id="colorNoiseReductionAmountValue">0.5</span>
        </div>
      </div>
      
      <div class="control-group">
        <label for="luminanceNoiseReductionAmount">Luminance Noise Reduction (0.0-1.0)</label>
        <div class="slider-container">
          <input type="range" id="luminanceNoiseReductionAmount" min="0" max="1" step="0.1" value="0.5">
          <span class="slider-value" id="luminanceNoiseReductionAmountValue">0.5</span>
        </div>
      </div>
      
      <div class="control-group">
        <label for="contrastAmount">Contrast Amount</label>
        <div class="slider-container">
          <input type="range" id="contrastAmount" min="0" max="2" step="0.1" value="1">
          <span class="slider-value" id="contrastAmountValue">1.0</span>
        </div>
      </div>
      
      <div class="control-group">
        <label for="sharpnessAmount">Sharpness Amount</label>
        <div class="slider-container">
          <input type="range" id="sharpnessAmount" min="0" max="2" step="0.1" value="1">
          <span class="slider-value" id="sharpnessAmountValue">1.0</span>
        </div>
      </div>
      
      <div class="control-group">
        <label for="noiseReductionAmount">Noise Reduction Amount</label>
        <div class="slider-container">
          <input type="range" id="noiseReductionAmount" min="0" max="1" step="0.1" value="0.5">
          <span class="slider-value" id="noiseReductionAmountValue">0.5</span>
        </div>
      </div>
      
      <div class="control-group">
        <label for="localToneMapAmount">Local Tone Map Amount</label>
        <div class="slider-container">
          <input type="range" id="localToneMapAmount" min="0" max="1" step="0.1" value="0">
          <span class="slider-value" id="localToneMapAmountValue">0.0</span>
        </div>
      </div>
      
      <div class="control-group">
        <label for="scaleFactor">Scale Factor</label>
        <input type="number" id="scaleFactor" min="0.1" max="2" step="0.1" value="1">
      </div>
      
      <div class="control-group">
        <label for="outputFormat">Output Format</label>
        <select id="outputFormat" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          <option value="jpeg" selected>JPEG</option>
          <option value="png">PNG</option>
          <option value="tiff">TIFF</option>
          <option value="jpeg2000">JPEG 2000</option>
          <option value="heif">HEIF/HEIC</option>
        </select>
      </div>
      
      <div class="control-group" id="qualityGroup">
        <label for="quality">Quality (0.0-1.0)</label>
        <div class="slider-container">
          <input type="range" id="quality" min="0" max="1" step="0.01" value="0.9">
          <span class="slider-value" id="qualityValue">0.90</span>
        </div>
      </div>
      
      <div class="control-group" id="embedThumbnailGroup">
        <label>
          <input type="checkbox" id="embedThumbnail">
          <span class="checkbox-label">Embed Thumbnail</span>
        </label>
      </div>
      
      <div class="control-group" id="optimizeColorGroup">
        <label>
          <input type="checkbox" id="optimizeColorForSharing">
          <span class="checkbox-label">Optimize Color for Sharing</span>
        </label>
      </div>
    </div>
    
    <div class="image-container">
      <button id="convertBtn" onclick="convert()">Convert Image</button>
      <img id="image" alt="Converted RAW image">
      <div id="status"></div>
    </div>
  </div>
  
  <script>
    // Reset all controls to default values
    function resetControls() {
      // Reset checkboxes
      document.getElementById('lensCorrection').checked = true;
      document.getElementById('disableGamutMap').checked = false;
      document.getElementById('allowDraftMode').checked = false;
      document.getElementById('ignoreImageOrientation').checked = false;
      document.getElementById('embedThumbnail').checked = false;
      document.getElementById('optimizeColorForSharing').checked = false;
      document.getElementById('preserveExifData').checked = true;
      
      // Reset sliders and their displayed values
      const sliderDefaults = {
        'exposure': '0',
        'boost': '1',
        'boostShadowAmount': '0',
        'baselineExposure': '0',
        'colorNoiseReductionAmount': '0.5',
        'luminanceNoiseReductionAmount': '0.5',
        'contrastAmount': '1',
        'sharpnessAmount': '1',
        'noiseReductionAmount': '0.5',
        'localToneMapAmount': '0',
        'quality': '0.9'
      };
      
      Object.entries(sliderDefaults).forEach(([id, value]) => {
        const slider = document.getElementById(id);
        const valueSpan = document.getElementById(id + 'Value');
        slider.value = value;
        valueSpan.textContent = value + (value.includes('.') ? '' : '.0');
      });
      
      // Reset number inputs
      document.getElementById('neutralTemperature').value = '';
      document.getElementById('neutralTint').value = '';
      document.getElementById('scaleFactor').value = '1';
      
      // Reset format dropdown
      document.getElementById('outputFormat').value = 'jpeg';
      
      // Update quality options visibility after reset
      updateQualityOptionsVisibility();
    }
    
    // Update slider values
    document.querySelectorAll('input[type="range"]').forEach(slider => {
      const valueSpan = document.getElementById(slider.id + 'Value');
      slider.addEventListener('input', () => {
        valueSpan.textContent = slider.value;
      });
    });
    
    // Function to update quality options visibility based on format
    function updateQualityOptionsVisibility() {
      const format = document.getElementById('outputFormat').value;
      const qualityGroup = document.getElementById('qualityGroup');
      const embedThumbnailGroup = document.getElementById('embedThumbnailGroup');
      const optimizeColorGroup = document.getElementById('optimizeColorGroup');
      
      // Quality slider is available for JPEG, HEIF, and JPEG2000 formats
      const qualityFormats = ['jpeg', 'heif', 'jpeg2000'];
      qualityGroup.style.display = qualityFormats.includes(format) ? 'block' : 'none';
      
      // Embed thumbnail is available for JPEG and HEIF formats
      const thumbnailFormats = ['jpeg', 'heif'];
      embedThumbnailGroup.style.display = thumbnailFormats.includes(format) ? 'block' : 'none';
      
      // Optimize color for sharing is available for all formats
      optimizeColorGroup.style.display = 'block';
    }
    
    // Add event listener for format changes
    document.getElementById('outputFormat').addEventListener('change', updateQualityOptionsVisibility);
    
    // Initialize quality options visibility
    updateQualityOptionsVisibility();
    
    function showStatus(message, type = 'info') {
      const status = document.getElementById('status');
      status.textContent = message;
      status.className = type;
      status.style.display = 'block';
      
      if (type === 'success' || type === 'error') {
        setTimeout(() => {
          status.style.display = 'none';
        }, 3000);
      }
    }
    
    async function convert() {
      const btn = document.getElementById('convertBtn');
      btn.disabled = true;
      showStatus('Converting...', 'info');
      
      const format = document.getElementById('outputFormat').value;
      
      const options = {
        format: format,
        lensCorrection: document.getElementById('lensCorrection').checked,
        exposure: parseFloat(document.getElementById('exposure').value),
        boost: parseFloat(document.getElementById('boost').value),
        boostShadowAmount: parseFloat(document.getElementById('boostShadowAmount').value),
        baselineExposure: parseFloat(document.getElementById('baselineExposure').value),
        disableGamutMap: document.getElementById('disableGamutMap').checked,
        allowDraftMode: document.getElementById('allowDraftMode').checked,
        ignoreImageOrientation: document.getElementById('ignoreImageOrientation').checked,
        preserveExifData: document.getElementById('preserveExifData').checked,
        scaleFactor: parseFloat(document.getElementById('scaleFactor').value)
      };
      
      // Add quality options based on format
      const qualityFormats = ['jpeg', 'heif', 'jpeg2000'];
      if (qualityFormats.includes(format)) {
        options.quality = parseFloat(document.getElementById('quality').value);
      }
      
      const thumbnailFormats = ['jpeg', 'heif'];
      if (thumbnailFormats.includes(format)) {
        options.embedThumbnail = document.getElementById('embedThumbnail').checked;
      }
      
      // All formats support optimizeColorForSharing
      options.optimizeColorForSharing = document.getElementById('optimizeColorForSharing').checked;
      
      // Add optional numeric values if they have been set
      const neutralTemp = document.getElementById('neutralTemperature').value;
      if (neutralTemp) options.neutralTemperature = parseInt(neutralTemp);
      
      const neutralTint = document.getElementById('neutralTint').value;
      if (neutralTint) options.neutralTint = parseInt(neutralTint);
      
      const colorNoise = document.getElementById('colorNoiseReductionAmount').value;
      if (colorNoise) options.colorNoiseReductionAmount = parseFloat(colorNoise);
      
      const lumNoise = document.getElementById('luminanceNoiseReductionAmount').value;
      if (lumNoise) options.luminanceNoiseReductionAmount = parseFloat(lumNoise);
      
      const contrast = document.getElementById('contrastAmount').value;
      if (contrast) options.contrastAmount = parseFloat(contrast);
      
      const sharpness = document.getElementById('sharpnessAmount').value;
      if (sharpness) options.sharpnessAmount = parseFloat(sharpness);
      
      const noiseReduction = document.getElementById('noiseReductionAmount').value;
      if (noiseReduction) options.noiseReductionAmount = parseFloat(noiseReduction);
      
      const localToneMap = document.getElementById('localToneMapAmount').value;
      if (localToneMap) options.localToneMapAmount = parseFloat(localToneMap);
      
      try {
        const response = await fetch('/convert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(options)
        });
        
        if (!response.ok) {
          throw new Error('Conversion failed');
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        const img = document.getElementById('image');
        img.src = url;
        img.style.display = 'block';
        
        const formatName = format.toUpperCase();
        showStatus('Conversion to ' + formatName + ' successful!', 'success');
      } catch (error) {
        showStatus('Conversion failed: ' + error.message, 'error');
      } finally {
        btn.disabled = false;
      }
    }
    
    // Load initial image with default settings
    window.onload = async function() {
      // Reset all controls to defaults
      resetControls();
      
      // Convert with default settings
      await convert();
    };
  </script>
</body>
</html>
  `);
});

// Convert endpoint
app.post(
  '/convert',
  express.json(),
  (req: ConvertRequest, res: Response): void => {
    try {
      const rawBuffer = loadSampleImage();
      const { format = 'jpeg', ...options } = req.body || {};

      const outputImage = convertRaw(
        rawBuffer,
        format as OutputFormat,
        options
      );

      // Set appropriate content type based on format
      const contentTypes: ContentTypeMap = {
        jpeg: 'image/jpeg',
        jpg: 'image/jpeg',
        png: 'image/png',
        tiff: 'image/tiff',
        tif: 'image/tiff',
        jpeg2000: 'image/jp2',
        jp2: 'image/jp2',
        heif: 'image/heif',
        heic: 'image/heic',
      };

      res.type(contentTypes[format] || 'image/jpeg');
      res.send(outputImage.buffer);
    } catch (error) {
      console.error('Conversion error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Start server
app.listen(PORT, () => {
  console.log(`Demo server running at http://localhost:${PORT}`);
});

export { app };
