const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env'), override: true });
const express = require('express');
const cors = require('cors');
const authRoutes = require('../backend/routes/auth');
const recordsRoutes = require('../backend/routes/records');
const uploadRoutes = require('../backend/routes/upload');
const communicationsRoutes = require('../backend/routes/communications');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/records/:recordId/communications', communicationsRoutes);
app.use('/api/records', recordsRoutes);

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum size is ' + (process.env.MAX_FILE_SIZE_MB || '5') + 'MB.' });
  }
  if (err.message && err.message.includes('xlsx')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = app;
