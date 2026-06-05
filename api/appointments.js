import { neon } from '@neondatabase/serverless';
import { sendWhatsApp } from './_whatsapp.js';

// Setup database instance from environment variables
const getDb = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not defined.');
  }
  return neon(connectionString);
};

export default async function handler(req, res) {
  // Setup standard headers for CORS compatibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const sql = getDb();

    if (req.method === 'GET') {
      // Retrieve all appointments ordered by the appointment time descending
      const appointments = await sql`
        SELECT * FROM appointments 
        ORDER BY appointment_time DESC
      `;
      return res.status(200).json(appointments);
    } 
    
    if (req.method === 'POST') {
      const { customer_name, phone, appointment_time } = req.body;

      if (!customer_name || !phone || !appointment_time) {
        return res.status(400).json({ error: 'All fields (customer_name, phone, appointment_time) are required.' });
      }

      // Save to Neon DB first (guarantees data persistence even if messaging fails)
      const result = await sql`
        INSERT INTO appointments (customer_name, phone, appointment_time)
        VALUES (${customer_name}, ${phone}, ${appointment_time})
        RETURNING *
      `;
      const appointment = result[0];

      // Format appointment time for the message body
      const formattedTime = new Date(appointment_time).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      // Template text for the appointment confirmation
      const messageText = `Hi ${customer_name}! Your appointment is confirmed for ${formattedTime}.\nReply CONFIRM to confirm or CANCEL to cancel.\n— CareSched`;

      let whatsappSent = false;
      let whatsappWarning = null;

      try {
        await sendWhatsApp(phone, messageText);
        whatsappSent = true;
      } catch (waError) {
        // Log WhatsApp failure details on the server and prepare warning for the frontend
        console.error('WhatsApp dispatch failure details:', waError);
        whatsappWarning = `Appointment saved, but WhatsApp confirmation failed: ${waError.message}`;
      }

      return res.status(201).json({
        appointment,
        whatsappSent,
        warning: whatsappWarning
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(455).json({ error: `Method ${req.method} not allowed` });
  } catch (error) {
    console.error('API Error in /api/appointments:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
