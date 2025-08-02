import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { convertRawToJpeg } from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const exampleRawPath = path.join(__dirname, 'DSC00053.ARW');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

// No longer storing converted image - always convert fresh

// Serve the HTML page
app.get('/', (_, res) => {
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
        'localToneMapAmount': '0'
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
    }
    
    // Update slider values
    document.querySelectorAll('input[type="range"]').forEach(slider => {
      const valueSpan = document.getElementById(slider.id + 'Value');
      slider.addEventListener('input', () => {
        valueSpan.textContent = slider.value;
      });
    });
    
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
      
      const options = {
        lensCorrection: document.getElementById('lensCorrection').checked,
        exposure: parseFloat(document.getElementById('exposure').value),
        boost: parseFloat(document.getElementById('boost').value),
        boostShadowAmount: parseFloat(document.getElementById('boostShadowAmount').value),
        baselineExposure: parseFloat(document.getElementById('baselineExposure').value),
        disableGamutMap: document.getElementById('disableGamutMap').checked,
        allowDraftMode: document.getElementById('allowDraftMode').checked,
        ignoreImageOrientation: document.getElementById('ignoreImageOrientation').checked,
        scaleFactor: parseFloat(document.getElementById('scaleFactor').value)
      };
      
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
        
        showStatus('Conversion successful!', 'success');
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
app.post('/convert', express.json(), (req, res) => {
  if (!fs.existsSync(exampleRawPath)) {
    return res.status(404).json({ error: `${exampleRawPath} not found` });
  }

  try {
    const rawBuffer = fs.readFileSync(exampleRawPath);
    const options = req.body || {};

    const jpegBuffer = convertRawToJpeg(rawBuffer, options);

    res.type('image/jpeg');
    res.send(jpegBuffer);
  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Demo server running at http://localhost:${PORT}`);
});
