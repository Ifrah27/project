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
console.log('Testing connection string:', connectionString ? 'Defined (hidden for privacy)' : 'Undefined');

if (!connectionString) {
  console.error('Error: DATABASE_URL is not set in your .env file!');
  process.exit(1);
}

try {
  const sql = neon(connectionString);
  console.log('Connecting to Neon Database...');
  
  // Run a simple query to verify the connection
  const result = await sql`SELECT NOW() as current_time;`;
  console.log('SUCCESS: Connected to the database!');
  console.log('Database current time:', result[0].current_time);
} catch (error) {
  console.error('FAILURE: Could not connect to the database.');
  console.error(error);
}
