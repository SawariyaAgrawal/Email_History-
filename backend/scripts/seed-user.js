/**
 * Seed script - create a default user for first-time login
 * Run: node scripts/seed-user.js
 * Default: email admin@example.com, password admin123 (change in production)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');

const DEFAULT_EMAIL = process.env.SEED_EMAIL || 'admin@example.com';
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || 'admin123';

async function seed() {
  try {
    const normalizedEmail = DEFAULT_EMAIL.toLowerCase().trim();
    const { data: existing, error: existingErr } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingErr) throw existingErr;
    if (existing) {
      console.log('User already exists:', normalizedEmail);
      process.exit(0);
      return;
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const { error } = await supabase
      .from('users')
      .insert([{ email: normalizedEmail, password: passwordHash }]);

    if (error) throw error;
    console.log('User created:', normalizedEmail, '(password:', DEFAULT_PASSWORD + ')');
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
