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
  allowedOrigins = process.env.CORS_ORIGINS.split(',').map(s => s.trim());
} else {
  // Default allowed origins for development and production
  allowedOrigins = [
    'https://peh-spinfinity.onrender.com',
    'http://localhost:3000',
    'http://localhost:5000'
  ];
}

// Configure CORS with proper error handling
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.warn(`Blocked origin: ${origin}`);
      callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
    }
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','x-session-id','Authorization','clientid','wheelid','routename','clientId','wheelId','routeName'],
  credentials: true,
  optionsSuccessStatus: 200,
  exposedHeaders: ['Content-Type']
}));

// Handle preflight requests
app.options('*', cors());

// Body parser with increased limit for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/spins', require('./src/routes/spins.routes'));
app.use('/api/wheels', require('./src/routes/wheels.routes'));
app.use('/api/spin-results', require('./src/routes/spinResults.routes'));
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/logins', require('./src/routes/login.routes'));
app.use('/api/analytics', require('./src/routes/analytics.routes'));
// Client and admin routes (client-edit workflow)
app.use('/api/client', require('./src/routes/client.routes'));
app.use('/api/admin', require('./src/routes/admin.routes'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'PEH Spinfinity API',
    version: '1.0.0',
    endpoints: [
      '/api/health',
      '/api/wheels',
      '/api/spin-results',
      '/api/logins',
      '/api/analytics'
    ]
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Server & DB
const PORT = process.env.PORT || 5000;
mongoose.set('strictQuery', true);

async function start() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI is not set in environment variables');
    
    await mongoose.connect(uri);
    
    console.log('✅ MongoDB connected successfully');
    console.log('📊 Database:', mongoose.connection.name);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 Allowed origins: ${allowedOrigins.join(', ')}`);
    });
  } catch (err) {
    console.error('❌ Startup error:', err.message);
    console.log('\n⚠️  Please ensure:');
    console.log('   1. MongoDB is running (for local development)');
    console.log('   2. Or update MONGO_URI in .env file with your MongoDB Atlas connection string');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

start();
