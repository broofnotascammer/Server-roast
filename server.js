import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { pipeline } from '@xenova/transformers';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3001;

// Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Multer for uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  }
});

// ================== Whisper Model ==================
let whisperPipeline;
let modelLoading = false;
let modelLoaded = false;

async function initializeModel() {
  if (modelLoading) return;
  modelLoading = true;
  console.log('🚀 Loading Whisper model...');

  try {
    whisperPipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small');
    modelLoaded = true;
    console.log('✅ Whisper model loaded successfully!');
  } catch (err) {
    console.error('❌ Error loading model:', err);
    modelLoaded = false;
  } finally {
    modelLoading = false;
  }
}

// ================== Roast Generator ==================
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
    category
  };
}

// ================== API Routes ==================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    model_loaded: modelLoaded,
    model_loading: modelLoading,
    timestamp: new Date().toISOString(),
    service: 'AI Roast Master API'
  });
});

app.post('/api/roast/text', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const roastData = generateRoast(text);
    res.json({ transcript: text, ...roastData, success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal error', success: false });
  }
});

app.post('/api/roast/audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Audio file required', success: false });
    if (!modelLoaded) return res.status(503).json({ error: 'Model still loading', success: false });

    const { text } = await whisperPipeline(req.file.buffer, { language: 'english', task: 'transcribe' });
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Could not transcribe audio', success: false });
    }

    const roastData = generateRoast(text);
    res.json({ transcript: text, ...roastData, success: true });
  } catch (err) {
    res.status(500).json({ error: 'Audio processing failed: ' + err.message, success: false });
  }
});

// ================== Serve index.html from root ==================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ================== Start Server ==================
async function startServer() {
  initializeModel().catch(console.error);
  app.listen(PORT, () => console.log(`🔥 Server running at http://localhost:${PORT}`));
}
startServer();

export default app;
