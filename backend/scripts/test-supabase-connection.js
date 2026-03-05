/**
 * Test Supabase connection and basic read
 * Run: node scripts/test-supabase-connection.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function testConnection() {
  try {
    console.log('Testing Supabase connection...\n');

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
      process.exit(1);
    }

    const supabase = require('../config/supabase');

    // Test: fetch one record
    const { data: records, error } = await supabase
      .from('records')
      .select('id, region, created_at')
      .limit(1);

    if (error) {
      console.error('Connection failed:', error.message);
      process.exit(1);
    }

    console.log('✓ Supabase connection successful');
    console.log(`  Records table accessible. Sample: ${records.length > 0 ? JSON.stringify(records[0]) : '(no records yet)'}\n`);

    // Test: fetch users count
    const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
    console.log(`✓ Users table accessible. Count: ${count ?? '?'}\n`);

    console.log('All checks passed.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

testConnection();
