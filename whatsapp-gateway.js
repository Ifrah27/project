import http from 'http';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import QRCodeImage from 'qrcode';
import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Load env vars from .env file
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
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

const getDb = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL environment variable is not defined.');
  return neon(connectionString);
};

const PORT = process.env.PORT || process.env.WHATSAPP_GATEWAY_PORT || 3001;

// ─── Global state ──────────────────────────────────────────────────────────────
let isClientReady = false;
let client = null;
let isRestarting = false;

// ─── Client factory ────────────────────────────────────────────────────────────
function createClient() {
  return new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    // type:none → WhatsApp serves its own latest version (most compatible)
    webVersionCache: { type: 'none' },
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-extensions'
      ]
    }
  });
}

// ─── Auto-restart logic ────────────────────────────────────────────────────────
async function restartClient(reason = 'unknown') {
  if (isRestarting) return;
  isRestarting = true;
  isClientReady = false;

  console.warn(`\n⚠ WhatsApp client restarting (reason: ${reason})...`);
  console.warn('Will reconnect in 5 seconds...\n');

  try {
    if (client) {
      client.removeAllListeners();
      await client.destroy().catch(() => {}); // best-effort destroy
    }
  } catch { /* ignore */ }

  setTimeout(() => {
    isRestarting = false;
    console.log('♻ Reinitializing WhatsApp client...\n');
    initializeClient();
  }, 5000);
}

// ─── Event wiring ──────────────────────────────────────────────────────────────
function wireClientEvents(c) {
  c.on('qr', (qr) => {
    console.log('\n--- SCAN THIS QR CODE WITH WHATSAPP ---');
    qrcode.generate(qr, { small: true });
    console.log('Instructions: Open WhatsApp → Settings/Menu → Linked Devices → Link a Device.\n');
    QRCodeImage.toFile('qr.png', qr, { margin: 2, scale: 8 }, (err) => {
      if (err) console.error('Failed to save QR image:', err);
      else console.log('✓ QR code saved to qr.png\n');
    });
  });

  c.on('ready', () => {
    isClientReady = true;
    console.log('\n======================================');
    console.log('  WhatsApp Gateway is ready! ✓');
    console.log('======================================\n');
  });

  c.on('auth_failure', (msg) => {
    isClientReady = false;
    console.error('\n=== AUTH FAILURE ===');
    console.error('Reason:', msg);
    console.error('Tip: Run "npm run reset-wa" then "npm run gateway" to re-link.\n');
    restartClient('auth_failure');
  });

  c.on('disconnected', (reason) => {
    isClientReady = false;
    console.warn(`WhatsApp disconnected: ${reason}`);
    restartClient(reason);
  });

  // Handle incoming CONFIRM / CANCEL replies
  c.on('message', async (msg) => {
    const text = msg.body.trim().toUpperCase();
    if (text !== 'CONFIRM' && text !== 'CANCEL') return;

    const phone = msg.from.split('@')[0];
    console.log(`Received "${text}" from ${phone}`);

    try {
      const sql = getDb();
      const appointments = await sql`
        SELECT id, customer_name FROM appointments
        WHERE phone = ${phone} AND status = 'Pending'
        ORDER BY appointment_time DESC
        LIMIT 1
      `;

      if (appointments.length > 0) {
        const appt = appointments[0];
        const newStatus = text === 'CONFIRM' ? 'Confirmed' : 'Cancelled';
        await sql`UPDATE appointments SET status = ${newStatus} WHERE id = ${appt.id}`;
        console.log(`✓ Updated appointment ${appt.id} (${appt.customer_name}) → ${newStatus}`);
        await msg.reply(`Thank you! Your appointment is now ${newStatus.toUpperCase()}.`);
      } else {
        console.log(`No pending appointment found for phone ${phone}`);
        await msg.reply(`We couldn't find a pending appointment for your number.`);
      }
    } catch (err) {
      console.error('Failed to process reply:', err);
    }
  });
}

// ─── Initialize ────────────────────────────────────────────────────────────────
function initializeClient() {
  console.log('Initializing WhatsApp client...');
  console.log('Scan the QR with: WhatsApp → Settings → Linked Devices → Link a Device\n');
  client = createClient();
  wireClientEvents(client);
  client.initialize().catch((err) => {
    console.error('Client initialize() error:', err.message);
    restartClient('initialize_error');
  });
}

// ─── Global crash recovery ─────────────────────────────────────────────────────
// Catches "Execution context was destroyed" and similar puppeteer crashes
process.on('uncaughtException', (err) => {
  console.error('\n[uncaughtException]', err.message);
  if (
    err.message.includes('Execution context was destroyed') ||
    err.message.includes('Target closed') ||
    err.message.includes('Session closed') ||
    err.message.includes('Protocol error')
  ) {
    restartClient('uncaughtException: ' + err.message.slice(0, 60));
  } else {
    // Unknown fatal error — log and exit so the OS/process manager can restart
    console.error('Fatal unhandled error — exiting:', err);
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error('\n[unhandledRejection]', msg);
  if (
    msg.includes('Execution context was destroyed') ||
    msg.includes('Target closed') ||
    msg.includes('Session closed') ||
    msg.includes('Protocol error')
  ) {
    restartClient('unhandledRejection: ' + msg.slice(0, 60));
  }
});

// ─── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // GET /  or  /qr  or  /qr.png  → serve the latest QR image
  if (req.method === 'GET' && ['/', '/qr', '/qr.png'].includes(req.url)) {
    const qrPath = join(process.cwd(), 'qr.png');
    if (fs.existsSync(qrPath)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(fs.readFileSync(qrPath));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>WhatsApp Gateway</h1><p>Initializing... refresh in a few seconds.</p>');
    }
    return;
  }

  // GET /status → connection state
  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ready: isClientReady,
      status: isRestarting ? 'restarting' : isClientReady ? 'connected' : 'initializing'
    }));
    return;
  }

  // POST /send → send a WhatsApp message
  if (req.method === 'POST' && req.url === '/send') {
    if (!isClientReady) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: isRestarting
          ? 'Gateway is restarting, please retry in a few seconds.'
          : 'WhatsApp client not ready. Scan the QR code first.'
      }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { to, message } = JSON.parse(body);
        if (!to || !message) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '"to" and "message" are required.' }));
          return;
        }

        const chatId = `${to.replace(/\D/g, '')}@c.us`;
        console.log(`Sending to ${chatId}...`);
        await client.sendMessage(chatId, message);
        console.log(`✓ Delivered to ${chatId}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Message sent.' }));
      } catch (err) {
        console.error('Send error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Failed to send.' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`WhatsApp Gateway HTTP server listening on port ${PORT}\n`);
  initializeClient();
});
