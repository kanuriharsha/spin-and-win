const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const wheelsRoutes = require('./routes/wheels.routes');
const spinResultsRoutes = require('./routes/spinResults.routes');
const spinsRoutes = require('./routes/spins.routes');
const loginsRoutes = require('./routes/logins.routes'); // new import

const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/wheels', wheelsRoutes);
app.use('/api/spin-results', spinResultsRoutes);
app.use('/api/spins', spinsRoutes);
app.use('/api/logins', loginsRoutes); // register new route

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