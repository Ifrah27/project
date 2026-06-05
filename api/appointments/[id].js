import { neon } from '@neondatabase/serverless';

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
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Obtain path parameter
  const { id } = req.query;

  if (req.method === 'PATCH') {
    try {
      const sql = getDb();
      const { status, reminder_sent } = req.body;

      let result;

      // Update depending on parameters passed
      if (status !== undefined && reminder_sent !== undefined) {
        result = await sql`
          UPDATE appointments
          SET status = ${status}, reminder_sent = ${reminder_sent}
          WHERE id = ${id}
          RETURNING *
        `;
      } else if (status !== undefined) {
        if (!['Pending', 'Confirmed', 'Cancelled'].includes(status)) {
          return res.status(400).json({ error: 'Invalid status. Must be Pending, Confirmed, or Cancelled.' });
        }
        result = await sql`
          UPDATE appointments
          SET status = ${status}
          WHERE id = ${id}
          RETURNING *
        `;
      } else if (reminder_sent !== undefined) {
        result = await sql`
          UPDATE appointments
          SET reminder_sent = ${reminder_sent}
          WHERE id = ${id}
          RETURNING *
        `;
      } else {
        return res.status(400).json({ error: 'At least one field (status or reminder_sent) must be specified for update.' });
      }

      if (result.length === 0) {
        return res.status(404).json({ error: 'Appointment not found.' });
      }

      return res.status(200).json(result[0]);
    } catch (error) {
      console.error('API Error in /api/appointments/[id]:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  }

  res.setHeader('Allow', ['PATCH']);
  return res.status(455).json({ error: `Method ${req.method} not allowed` });
}
