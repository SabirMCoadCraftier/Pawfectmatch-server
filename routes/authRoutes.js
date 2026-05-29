const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getDB } = require('../config/db');
const { verifyToken } = require('../middleware/verifyToken');

router.post('/login', async (req, res) => {
  const { email, name, photoURL } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const db = getDB();
    const usersCollection = db.collection('users');

    let user = await usersCollection.findOne({ email });
    if (!user) {
      const newUser = {
        email,
        name: name || email.split('@')[0],
        photoURL: photoURL || '',
        role: 'user',
        createdAt: new Date(),
      };
      const result = await usersCollection.insertOne(newUser);
      user = { ...newUser, _id: result.insertedId };
    }

    const token = jwt.sign(
      { email: user.email, name: user.name, photoURL: user.photoURL, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: 'Login successful',
      token,
      user: { email: user.email, name: user.name, photoURL: user.photoURL, role: user.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  });
  res.status(200).json({ message: 'Logout successful' });
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const user = await db.collection('users').findOne(
      { email: req.user.email },
      { projection: { _id: 1, email: 1, name: 1, photoURL: 1, role: 1 } }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;