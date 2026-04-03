const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const recordsRoutes = require('./routes/records');
const uploadRoutes = require('./routes/upload');
const communicationsRoutes = require('./routes/communications');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/records/:recordId/communications', communicationsRoutes);
app.use('/api/records', recordsRoutes);

// Serve frontend static files (HTML, CSS, JS)
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Global error handler for multer (file size, etc.)
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum size is ' + (process.env.MAX_FILE_SIZE_MB || '5') + 'MB.' });
  }
  if (err.message && err.message.includes('xlsx')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
