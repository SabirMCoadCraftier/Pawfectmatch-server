const jwt = require('jsonwebtoken');
const { getDB } = require('../config/db');

const verifyToken = (req, res, next) => {
  const token =
    req.cookies?.token ||
    req.headers?.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized - No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized - Invalid token' });
  }
};

const verifyAdmin = async (req, res, next) => {
  try {
    const db = getDB();
    const user = await db.collection('users').findOne(
      { email: req.user.email },
      { projection: { role: 1 } }
    );

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden - Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Admin verification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { verifyToken, verifyAdmin };