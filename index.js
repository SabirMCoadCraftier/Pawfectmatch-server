const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const https = require('https');
require('dotenv').config();
const { connectDB } = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const petRoutes = require('./routes/petRoutes');
const adoptionRoutes = require('./routes/adoptionRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: [
      process.env.CLIENT_URL || 'http://localhost:5173',
      'https://pawfectmatch-client.vercel.app',
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/adoption-requests', adoptionRoutes);
app.use('/api/admin', adminRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Health check
app.get('/', (req, res) => {
  res.json({ message: '🐾 Pet Adoption API is running' });
});

const dbConnection = connectDB();

module.exports = app;

if (process.env.VERCEL !== '1') {
  dbConnection
    .then(() => {
      app.listen(port, () => {
        console.log(`🚀 Server running on port ${port}`);

        // Keep alive - ping every 14 minutes
        if (process.env.NODE_ENV !== 'development') {
          setInterval(() => {
            https.get('https://pawfectmatch-server-q6yd.onrender.com/', (res) => {
              console.log(`🔄 Keep alive ping: ${res.statusCode}`);
            }).on('error', (err) => {
              console.log('Keep alive error:', err.message);
            });
          }, 14 * 60 * 1000);
        }
      });
    })
    .catch(() => {
      process.exit(1);
    });
}