/**
 * Authentication routes - login, signup
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const router = express.Router();

// POST /api/auth/signup - Register new user
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(password, 10);
    const { data: user, error } = await supabase
      .from('users')
      .insert([{ email: normalizedEmail, password: passwordHash }])
      .select('id, email')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'An account with this email already exists.' });
      }
      throw error;
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'default-secret-change-me',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

// POST /api/auth/login - User login with email, password, and region
router.post('/login', async (req, res) => {
  try {
    const { email, password, region } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error) throw error;
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'default-secret-change-me',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email },
      region: region || null,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

module.exports = router;
