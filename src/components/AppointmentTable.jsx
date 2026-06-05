export default function AppointmentTable({ appointments, isLoading, onStatusChange, lastUpdated }) {
  // Format the date/time string to be human readable
  const formatTime = (timeStr) => {
    try {
      return new Date(timeStr).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return timeStr;
    }
  };

  // Checks if the appointment date is today
  const isToday = (timeStr) => {
    try {
      const apptDate = new Date(timeStr);
      const today = new Date();
      return (
        apptDate.getDate() === today.getDate() &&
        apptDate.getMonth() === today.getMonth() &&
        apptDate.getFullYear() === today.getFullYear()
      );
    } catch {
      return false;
    }
  };

  return (
    <div className="glass-card" style={{ flexGrow: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)' }}>Live Appointment Dashboard</h2>
          {lastUpdated && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Last synced: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        {isLoading && <span className="loading-spinner" style={{ width: '20px', height: '20px' }}></span>}
      </div>

      <div className="table-wrapper">
        {appointments.length === 0 ? (
          <div className="empty-state">
            <p>No appointments booked yet.</p>
          </div>
        ) : (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Appointment Time</th>
                <th>Reminder Sent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt) => {
                const apptIsToday = isToday(appt.appointment_time);
                return (
                  <tr 
                    key={appt.id} 
                    style={apptIsToday ? { backgroundColor: 'rgba(168, 85, 247, 0.12)', borderLeft: '3px solid var(--accent-purple)' } : {}}
                  >
                    <td style={{ fontWeight: 600 }}>
                      {appt.customer_name} {apptIsToday && <span style={{ color: 'var(--accent-purple)', fontSize: '0.75rem', marginLeft: '6px' }}>(Today)</span>}
                    </td>
                    <td>{appt.phone}</td>
                    <td>{formatTime(appt.appointment_time)}</td>
                    <td>
                      {appt.reminder_sent ? (
                        <span className="reminder-badge sent">Sent ✓</span>
                      ) : (
                        <span className="reminder-badge unsent">Pending</span>
                      )}
                    </td>
                    <td>
                      <select
                        className={`inline-select status-badge ${appt.status.toLowerCase()}`}
                        value={appt.status}
                        onChange={(e) => onStatusChange(appt.id, e.target.value)}
                      >
                        <option value="Pending" style={{ color: 'var(--status-pending-text)', backgroundColor: '#111' }}>Pending</option>
                        <option value="Confirmed" style={{ color: 'var(--status-confirmed-text)', backgroundColor: '#111' }}>Confirmed</option>
                        <option value="Cancelled" style={{ color: 'var(--status-cancelled-text)', backgroundColor: '#111' }}>Cancelled</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
