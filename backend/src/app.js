const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const wheelsRoutes = require('./routes/wheels.routes');
const spinResultsRoutes = require('./routes/spinResults.routes');
const spinsRoutes = require('./routes/spins.routes');
const loginsRoutes = require('./routes/logins.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const authRoutes = require('./routes/auth.routes'); // import auth routes
const clientRoutes = require('./routes/client.routes'); // import client routes
const adminRoutes = require('./routes/admin.routes'); // import admin routes

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images

// API routes
app.use('/api/auth', authRoutes); // auth routes (login)
app.use('/api/wheels', wheelsRoutes);
app.use('/api/spin-results', spinResultsRoutes);
app.use('/api/spins', spinsRoutes);
app.use('/api/logins', loginsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/client', clientRoutes); // client-specific routes
app.use('/api/admin', adminRoutes); // admin-specific routes

// Root route (for testing)
app.get('/', (req, res) => {
  res.send('API is running');
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Connect to MongoDB and start the server
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/spin-and-win', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Connected to MongoDB');
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
})
.catch(err => {
  console.error('MongoDB connection error:', err);
});