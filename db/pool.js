require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL ||
  (process.env.PGHOST
    ? `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`
    : null);

const isInternal = connectionString?.includes('railway.internal');

const pool = new Pool({
  connectionString,
  ssl: isInternal ? false : { rejectUnauthorized: false }
});

pool.on('error', (err) => console.error('DB pool error:', err.message));

module.exports = pool;
