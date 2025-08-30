import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { pipeline } from '@xenova/transformers';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
    origin: [
        'https://broofnotascammer.github.io',
        'http://localhost:8000',
        'http://127.0.0.1:5500',
        'http://localhost:3000'
    ],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed!'), false);
        }
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
    }
    res.status(500).json({ error: error.message });
});

// Initialize Whisper model
let whisperPipeline;
let modelLoading = false;
let modelLoaded = false;

async function initializeModel() {
    if (modelLoading) return;
    
    modelLoading = true;
    console.log('🚀 Loading Whisper model...');
    
    try {
        whisperPipeline = await pipeline(
            'automatic-speech-recognition',
            'Xenova/whisper-small'
        );
        modelLoaded = true;
        console.log('✅ Whisper model loaded successfully!');
    } catch (error) {
        console.error('❌ Error loading model:', error);
        modelLoaded = false;
    } finally {
        modelLoading = false;
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

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        model_loaded: modelLoaded,
        model_loading: modelLoading,
        timestamp: new Date().toISOString(),
        service: 'AI Roast Master API'
    });
});

// Text roasting endpoint
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
            category: roastData.category,
            success: true
        });
    } catch (error) {
        console.error('Error processing text:', error);
        res.status(500).json({ error: 'Internal server error', success: false });
    }
});

// Audio roasting endpoint
app.post('/api/roast/audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Audio file is required', success: false });
        }

        if (!modelLoaded) {
            return res.status(503).json({ 
                error: 'Model not loaded yet. Please try again in a moment.', 
                success: false 
            });
        }

        console.log('🎤 Processing audio file...');

        // Transcribe audio using Whisper
        const { text } = await whisperPipeline(req.file.buffer, {
            language: 'english',
            task: 'transcribe'
        });

        console.log('📝 Transcription:', text);
        
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Could not transcribe audio. Please try again with clearer audio.', 
                success: false 
            });
        }

        const roastData = generateRoast(text);
        res.json({
            transcript: text,
            roast: roastData.roast,
            category: roastData.category,
            success: true
        });
    } catch (error) {
        console.error('Error processing audio:', error);
        res.status(500).json({ 
            error: 'Error processing audio: ' + error.message, 
            success: false 
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'AI Roast Master API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            textRoast: 'POST /api/roast/text',
            audioRoast: 'POST /api/roast/audio'
        },
        status: 'operational'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found', success: false });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error', success: false });
});

// Start server
async function startServer() {
    try {
        // Initialize model in background
        initializeModel().catch(console.error);
        
        app.listen(PORT, () => {
            console.log(`🔥 AI Roast Master API running on port ${PORT}`);
            console.log(`📍 Local: http://localhost:${PORT}`);
            console.log(`📊 Health: http://localhost:${PORT}/api/health`);
            console.log('⏳ Loading Whisper model... (this may take a few minutes)');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM. Shutting down...');
    process.exit(0);
});

// Start the server
startServer();

export default app;    
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
    }
    res.status(500).json({ error: error.message });
});

// Initialize Whisper model
let whisperPipeline;
let modelLoading = false;
let modelLoaded = false;

async function initializeModel() {
    if (modelLoading) return;
    
    modelLoading = true;
    console.log('🚀 Loading Whisper model...');
    
    try {
        whisperPipeline = await pipeline(
            'automatic-speech-recognition',
            'Xenova/whisper-small',
            {
                progress_callback: (progress) => {
                    console.log(`Download progress: ${(progress * 100).toFixed(1)}%`);
                }
            }
        );
        modelLoaded = true;
        console.log('✅ Whisper model loaded successfully!');
    } catch (error) {
        console.error('❌ Error loading model:', error);
        modelLoaded = false;
    } finally {
        modelLoading = false;
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

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        model_loaded: modelLoaded,
        model_loading: modelLoading,
        timestamp: new Date().toISOString(),
        service: 'AI Roast Master API'
    });
});

// Text roasting endpoint
app.post('/api/roast/text', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        if (typeof text !== 'string') {
            return res.status(400).json({ error: 'Text must be a string' });
        }

        const roastData = generateRoast(text);
        res.json({
            transcript: text,
            roast: roastData.roast,
            category: roastData.category,
            success: true
        });
    } catch (error) {
        console.error('Error processing text:', error);
        res.status(500).json({ error: 'Internal server error', success: false });
    }
});

// Audio roasting endpoint
app.post('/api/roast/audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Audio file is required', success: false });
        }

        if (!modelLoaded) {
            return res.status(503).json({ 
                error: 'Model not loaded yet. Please try again in a moment.', 
                success: false 
            });
        }

        console.log('🎤 Processing audio file...');
        console.log('File info:', {
            size: req.file.size,
            mimetype: req.file.mimetype,
            originalname: req.file.originalname
        });

        // Transcribe audio using Whisper
        const { text } = await whisperPipeline(req.file.buffer, {
            language: 'english',
            task: 'transcribe',
            chunk_length_s: 30,
            stride_length_s: 5
        });

        console.log('📝 Transcription:', text);
        
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Could not transcribe audio. Please try again with clearer audio.', 
                success: false 
            });
        }

        const roastData = generateRoast(text);
        res.json({
            transcript: text,
            roast: roastData.roast,
            category: roastData.category,
            success: true
        });
    } catch (error) {
        console.error('Error processing audio:', error);
        res.status(500).json({ 
            error: 'Error processing audio: ' + error.message, 
            success: false 
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'AI Roast Master API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            textRoast: 'POST /api/roast/text',
            audioRoast: 'POST /api/roast/audio'
        },
        status: 'operational'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found', success: false });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error', success: false });
});

// Start server
async function startServer() {
    try {
        // Initialize model in background
        initializeModel().catch(console.error);
        
        app.listen(PORT, () => {
            console.log(`🔥 AI Roast Master API running on port ${PORT}`);
            console.log(`📍 Local: http://localhost:${PORT}`);
            console.log(`📊 Health: http://localhost:${PORT}/api/health`);
            console.log('⏳ Loading Whisper model... (this may take a few minutes)');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM. Shutting down...');
    process.exit(0);
});

// Start the server
startServer();

module.exports = app;
