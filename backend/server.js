'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');

const app = express();

// Add for Render proxy
app.set('trust proxy', 1);

// Middleware
let allowedOrigins;
if (process.env.CORS_ORIGINS) {
  // Multiple origins separated by comma
  allowedOrigins = process.env.CORS_ORIGINS.split(',').map(s => s.trim());
} else if (process.env.CORS_ORIGIN) {
  allowedOrigins = process.env.CORS_ORIGIN.split(',').map(s => s.trim());
} else {
  allowedOrigins = '*'; // Allow all origins as fallback
}

// Configure CORS
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins === '*' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','x-session-id','Authorization'],
  credentials: false
}));

// Handle preflight requests
app.options('*', cors({
  origin: allowedOrigins
}));

// Body parser
app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads

// Logging
app.use(morgan('dev'));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState }); // 1 = connected
});
app.use('/api/spins', require('./src/routes/spins.routes'));
app.use('/api/wheels', require('./src/routes/wheels.routes'));
app.use('/api/spin-results', require('./src/routes/spinResults.routes'));
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/logins', require('./src/routes/login.routes'));

// Server & DB
const PORT = process.env.PORT || 5000;
mongoose.set('strictQuery', true);

async function start() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI is not set');
    await mongoose.connect(uri); // DB name provided in URI: /spin-and-win
    console.log('MongoDB connected');

    app.listen(PORT, () => {
      console.log(`API listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Startup error:', err.message);
    process.exit(1);
  }
}

start();
