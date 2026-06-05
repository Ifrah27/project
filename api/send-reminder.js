import { neon } from '@neondatabase/serverless';
import { sendWhatsApp } from './_whatsapp.js';

// Setup database instance
const getDb = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not defined.');
  }
  return neon(connectionString);
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { id, customer_name, phone, appointment_time } = req.body;

      if (!id || !customer_name || !phone || !appointment_time) {
        return res.status(400).json({ error: 'All fields (id, customer_name, phone, appointment_time) are required.' });
      }

      // Format appointment time for the reminder message
      const formattedTime = new Date(appointment_time).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      const messageText = `Reminder: Hi ${customer_name}, your appointment is in less than 1 hour (${formattedTime}).\nPlease reply CONFIRM to confirm. — CareSched`;

      // 1. Trigger the WhatsApp Cloud API dispatch
      await sendWhatsApp(phone, messageText);

      // 2. Mark reminder_sent = true in Neon DB to prevent double notifications
      const sql = getDb();
      const result = await sql`
        UPDATE appointments
        SET reminder_sent = true
        WHERE id = ${id}
        RETURNING *
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Appointment not found in database to update.' });
      }

      return res.status(200).json({
        success: true,
        appointment: result[0]
      });
    } catch (error) {
      console.error('API Error in /api/send-reminder:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  }

  res.setHeader('Allow', ['POST']);
  return res.status(455).json({ error: `Method ${req.method} not allowed` });
}
