'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');

const app = express();

// Middleware
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : (process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
      : true); // true => reflect request origin
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','x-session-id','Authorization'],
  credentials: false
}));
app.options('*', cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads
app.use(morgan('dev'));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState }); // 1=connected
});
app.use('/api/spins', require('./src/routes/spins.routes'));
app.use('/api/wheels', require('./src/routes/wheels.routes'));
app.use('/api/spin-results', require('./src/routes/spinResults.routes'));

const PORT = process.env.PORT || 5000;

mongoose.set('strictQuery', true);

async function start() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI is not set');
    await mongoose.connect(uri); // DB name provided in URI: /spin-and-win
    console.log('MongoDB connected');

    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Startup error:', err.message);
    process.exit(1);
  }
}

start();
