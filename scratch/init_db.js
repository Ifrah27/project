import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Error: DATABASE_URL is not set in your .env file!');
  process.exit(1);
}

try {
  const sql = neon(connectionString);
  console.log('Connecting to Neon Database to create table...');
  
  await sql`
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      appointment_time TIMESTAMPTZ NOT NULL,
      status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','Confirmed','Cancelled')),
      reminder_sent BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `;
  
  console.log('SUCCESS: Table "appointments" has been created successfully!');
} catch (error) {
  console.error('FAILURE: Could not create table.');
  console.error(error);
}
