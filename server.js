const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { pipeline } = require('@xenova/transformers');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  }
});

// Initialize Whisper model
let whisperPipeline;
async function initializeModel() {
  try {
    console.log('Loading Whisper model...');
    whisperPipeline = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-small'
    );
    console.log('Whisper model loaded successfully!');
  } catch (error) {
    console.error('Error loading model:', error);
  }
}

// Roast generation function
function generateRoast(topic) {
  const roastTemplates = {
    fashion: [
      "Your fashion sense is so bad, even a scarecrow would give you fashion advice.",
      "If ugly were a crime, your outfit would be a life sentence without parole.",
      "Your style is what happens when a blindfolded person dresses in the dark during a power outage."
    ],
    food: [
      "That food choice is so wrong, even the garbage can would reject it.",
      "Your taste in food is what happens when someone lets a toddler plan the menu.",
      "That dish is so bad, it makes cafeteria food look like a Michelin-star meal."
    ],
    tech: [
      "Your tech skills are so outdated, you make dial-up internet look cutting edge.",
      "If incompetence were code, you'd be the entire Stack Overflow of failure.",
      "Your coding is so bad, even a broken keyboard would produce better output."
    ],
    talent: [
      "Your talent is so limited, it makes a rock look multi-talented.",
      "If failure were an Olympic sport, you'd be the gold medalist, world record holder, and defending champion.",
      "Your skills are so poor, even a participation trophy would feel insulted to be given to you."
    ],
    default: [
      "is so disappointing, even my AI feelings got hurt analyzing it.",
      "makes me wish I was a simple calculator instead of dealing with this.",
      "is the reason why aliens won't talk to us."
    ]
  };

  let category = 'default';
  const topicLower = topic.toLowerCase();

  if (topicLower.includes('fashion') || topicLower.includes('cloth') || 
      topicLower.includes('dress') || topicLower.includes('style') ||
      topicLower.includes('outfit')) {
    category = 'fashion';
  } else if (topicLower.includes('food') || topicLower.includes('pizza') || 
            topicLower.includes('eat') || topicLower.includes('dish') ||
            topicLower.includes('pineapple')) {
    category = 'food';
  } else if (topicLower.includes('tech') || topicLower.includes('code') || 
            topicLower.includes('computer') || topicLower.includes('program')) {
    category = 'tech';
  } else if (topicLower.includes('sing') || topicLower.includes('talent') || 
            topicLower.includes('skill') || topicLower.includes('voice')) {
    category = 'talent';
  }

  const roasts = roastTemplates[category];
  const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];

  return {
    roast: category === 'default' ? `"${topic}" ${randomRoast}` : randomRoast,
    category: category
  };
}

// Routes
app.post('/api/roast/text', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const roastData = generateRoast(text);
    res.json({
      transcript: text,
      roast: roastData.roast,
      category: roastData.category
    });
  } catch (error) {
    console.error('Error processing text:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/roast/audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    if (!whisperPipeline) {
      return res.status(503).json({ error: 'Model not loaded yet' });
    }

    console.log('Transcribing audio...');
    
    // Convert buffer to appropriate format for Whisper
    const audioData = req.file.buffer;
    
    // Transcribe audio using Whisper
    const { text } = await whisperPipeline(audioData, {
      language: 'english',
      task: 'transcribe'
    });

    console.log('Transcription:', text);
    
    const roastData = generateRoast(text);
    res.json({
      transcript: text,
      roast: roastData.roast,
      category: roastData.category
    });
  } catch (error) {
    console.error('Error processing audio:', error);
    res.status(500).json({ error: 'Error processing audio' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    model_loaded: !!whisperPipeline,
    timestamp: new Date().toISOString()
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initializeModel();
});
