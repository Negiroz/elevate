// Force restart v9 (Debug Response)
import express from 'express';
import cors from 'cors';
import router from './routes.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = 3002;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '../dist');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Logging middleware with status codes
app.use((req, res, next) => {
    res.on('finish', () => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode}`);
    });
    next();
});

// Request static files first
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(distPath));

// API routes
app.use('/api', router);

// Handle SPA routing - send index.html for all other routes
app.get('*', (req, res) => {
    // Prevent infinite loops by not serving index.html for missing assets or API calls
    if (req.url.includes('.') || req.url.startsWith('/api')) {
        return res.status(404).send('Not Found');
    }
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

