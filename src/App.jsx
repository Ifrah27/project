import { useState, useEffect, useRef, useCallback } from 'react';
import AppointmentForm from './components/AppointmentForm';
import AppointmentTable from './components/AppointmentTable';

export default function App() {
  const [activeTab, setActiveTab] = useState('split'); // 'book', 'dashboard', or 'split'
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Ref to hold the latest state of appointments for the background interval
  const appointmentsRef = useRef([]);
  useEffect(() => {
    appointmentsRef.current = appointments;
  }, [appointments]);

  // Handle toast notifications
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  // Fetch appointments list
  const fetchAppointments = useCallback(async (silent = false) => {
    if (!silent) {
      setTimeout(() => setIsLoading(true), 0);
    }
    try {
      const response = await fetch('/api/appointments');
      if (!response.ok) {
        throw new Error('Failed to retrieve appointments.');
      }
      const data = await response.json();
      setAppointments(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Fetch Error:', error);
      addToast(error.message || 'Error pulling appointments.', 'error');
    } finally {
      if (!silent) {
        setTimeout(() => setIsLoading(false), 0);
      }
    }
  }, [addToast]);

  // Status Change Handler (with instant Optimistic UI update)
  const handleStatusChange = useCallback(async (id, newStatus) => {
    const originalAppointments = [...appointments];
    setAppointments((prev) =>
      prev.map((appt) => (appt.id === id ? { ...appt, status: newStatus } : appt))
    );

    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Server update failed.');
      }
      
      const updatedAppt = await response.json();
      addToast(`Status updated to ${newStatus}`, 'success');
      
      // Update local state with official DB record
      setAppointments((prev) =>
        prev.map((appt) => (appt.id === id ? updatedAppt : appt))
      );
    } catch (error) {
      console.error('Update status error:', error);
      addToast('Failed to save status update. Reverting change.', 'error');
      setAppointments(originalAppointments);
    }
  }, [appointments, addToast]);

  // Appends new appointments immediately upon user booking
  const handleAppointmentCreated = useCallback((newAppointment) => {
    setAppointments((prev) => [newAppointment, ...prev]);
  }, []);

  // Feature 3: Polling appointments every 10 seconds with interval cleanup
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAppointments();
    }, 0);

    const intervalId = setInterval(() => {
      fetchAppointments(true); // silent fetch in background
    }, 10000);

    return () => {
      clearTimeout(timer);
      clearInterval(intervalId);
    };
  }, [fetchAppointments]);

  // Feature 4: Auto-Reminder interval check running every 60 seconds
  useEffect(() => {
    const reminderIntervalId = setInterval(async () => {
      const currentList = appointmentsRef.current;
      const now = new Date();

      for (const appt of currentList) {
        // Logic: Pending status, reminder not sent yet, and within 60 minutes
        if (appt.status === 'Pending' && !appt.reminder_sent) {
          const apptTime = new Date(appt.appointment_time);
          const diffInMs = apptTime - now;
          const diffInMinutes = diffInMs / (1000 * 60);

          if (diffInMinutes > 0 && diffInMinutes <= 60) {
            console.log(`Auto Reminder condition matched for ${appt.customer_name}. Sending reminder...`);
            
            try {
              const response = await fetch('/api/send-reminder', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  id: appt.id,
                  customer_name: appt.customer_name,
                  phone: appt.phone,
                  appointment_time: appt.appointment_time,
                }),
              });

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to dispatch auto-reminder.');
              }

              const result = await response.json();
              
              // Update local state with the modified appointment record
              setAppointments((prev) =>
                prev.map((a) => (a.id === appt.id ? result.appointment : a))
              );
              
              addToast(`Auto reminder sent to ${appt.customer_name}!`, 'success');
              console.log(`Reminder successfully sent to appointment ID: ${appt.id}`);
            } catch (err) {
              console.error(`Auto Reminder dispatch failed for ${appt.id}:`, err);
            }
          } else {
            console.log(`Skipped reminder for ${appt.customer_name} (time difference in minutes: ${diffInMinutes.toFixed(1)})`);
          }
        }
      }
    }, 60000);

    return () => clearInterval(reminderIntervalId);
  }, [addToast]);

  return (
    <div className="app-container">
      <header>
        <h1 className="app-title">CareSched</h1>
        <p className="app-subtitle">Real-time WhatsApp Cloud API Reminders</p>
      </header>

      {/* Navigation tabs */}
      <div className="tabs-navigation">
        <button
          className={`tab-btn ${activeTab === 'book' ? 'active' : ''}`}
          onClick={() => setActiveTab('book')}
        >
          Book Appointment
        </button>
        <button
          className={`tab-btn ${activeTab === 'split' ? 'active' : ''}`}
          onClick={() => setActiveTab('split')}
        >
          Split View
        </button>
        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Live Dashboard
        </button>
      </div>

      {/* Layout panels */}
      <main>
        {activeTab === 'split' && (
          <div className="grid-2">
            <AppointmentForm onAppointmentCreated={handleAppointmentCreated} addToast={addToast} />
            <AppointmentTable
              appointments={appointments}
              isLoading={isLoading}
              onStatusChange={handleStatusChange}
              lastUpdated={lastUpdated}
            />
          </div>
        )}

        {activeTab === 'book' && (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <AppointmentForm onAppointmentCreated={handleAppointmentCreated} addToast={addToast} />
          </div>
        )}

        {activeTab === 'dashboard' && (
          <AppointmentTable
            appointments={appointments}
            isLoading={isLoading}
            onStatusChange={handleStatusChange}
            lastUpdated={lastUpdated}
          />
        )}
      </main>

      {/* Toast systems */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}>
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
