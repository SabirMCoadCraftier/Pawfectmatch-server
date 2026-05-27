const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
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
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
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

// ─── Database Connection ──────────────────────────────────────
// Starts connecting immediately at module scope.
// On Vercel, this runs on every cold start; the connection is
// reused across warm invocations via Node's module cache.
// In local dev, we wait for the connection before starting the
// HTTP server (see the `if (VERCEL !== '1')` block below).
const dbConnection = connectDB();

// ─── Vercel Serverless Export ──────────────────────────────────
// Vercel needs the Express app exported as its module handler.
// The `app.listen()` below only runs in local/dev environments.
module.exports = app;

// ─── Local Development Server ───────────────────────────────────
if (process.env.VERCEL !== '1') {
  dbConnection
    .then(() => {
      app.listen(port, () => {
        console.log(`🚀 Server running on port ${port}`);
      });
    })
    .catch(() => {
      process.exit(1); // error already logged by connectDB()
    });
}
