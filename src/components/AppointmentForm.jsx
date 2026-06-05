import { useState } from 'react';

export default function AppointmentForm({ onAppointmentCreated, addToast }) {
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    appointmentTime: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Basic validation
    if (!formData.customerName.trim()) {
      addToast('Customer name is required.', 'error');
      return;
    }

    // 2. Validate phone number: strip non-digits, must be at least 10 digits
    const digitsOnlyPhone = formData.phone.replace(/\D/g, '');
    if (digitsOnlyPhone.length < 10) {
      addToast('Phone number must contain at least 10 digits with country code (e.g. 919876543210).', 'error');
      return;
    }

    // 3. Validate appointment_time: must be a future datetime
    const selectedDate = new Date(formData.appointmentTime);
    const now = new Date();
    if (!formData.appointmentTime || selectedDate <= now) {
      addToast('Appointment time must be in the future.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // POST payload to the Vercel Serverless Route
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_name: formData.customerName.trim(),
          phone: digitsOnlyPhone,
          appointment_time: formData.appointmentTime,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save appointment to the database.');
      }

      const result = await response.json();

      // Show toast indicating DB insert status & WhatsApp API feedback
      if (result.whatsappSent) {
        addToast(`Appointment saved! WhatsApp sent to ${digitsOnlyPhone}`, 'success');
      } else {
        // WhatsApp API failed (e.g. invalid test recipient), show warning but acknowledge successful DB save
        addToast(`Appointment saved! ${result.warning || 'WhatsApp dispatch warning'}`, 'error');
      }

      // Reset form fields
      setFormData({
        customerName: '',
        phone: '',
        appointmentTime: '',
      });

      if (onAppointmentCreated) {
        onAppointmentCreated(result.appointment);
      }
    } catch (error) {
      console.error('Submit Form Error:', error);
      addToast(error.message || 'An error occurred while booking. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-card">
      <h2 style={{ marginBottom: '20px', fontFamily: 'var(--font-heading)' }}>Book Appointment</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="customerName">Customer Name</label>
          <input
            id="customerName"
            type="text"
            name="customerName"
            className="form-input"
            placeholder="John Doe"
            value={formData.customerName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="phone">Phone Number (digits only, e.g. 919876543210)</label>
          <input
            id="phone"
            type="tel"
            name="phone"
            className="form-input"
            placeholder="919876543210"
            value={formData.phone}
            onChange={handleChange}
            required
          />
          <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '-4px' }}>
            Include country code without '+' or spaces.
          </small>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="appointmentTime">Date & Time</label>
          <input
            id="appointmentTime"
            type="datetime-local"
            name="appointmentTime"
            className="form-input"
            value={formData.appointmentTime}
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></span>
              Booking...
            </>
          ) : 'Book Appointment'}
        </button>
      </form>
    </div>
  );
}
