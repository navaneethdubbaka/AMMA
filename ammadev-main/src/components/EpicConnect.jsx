import { useState, useEffect } from 'react';
import { initEpicAuth, isEpicConnected, disconnectEpic } from '../utils/epicClient';

function EpicConnect({ doctorEmail }) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    checkConnection();
  }, [doctorEmail]);

  const checkConnection = async () => {
    try {
      const isConnected = await isEpicConnected(doctorEmail);
      setConnected(isConnected);
    } catch (error) {
      console.error('Error checking Epic connection:', error);
    }
    setLoading(false);
  };

  const handleConnect = async () => {
    try {
      const authUrl = initEpicAuth(doctorEmail);
      
      // If authUrl is null, we're in demo mode - just reload to show connected state
      if (authUrl === null) {
        alert('✅ Demo mode enabled! You can now search for demo patients.');
        // Reload to update connection status
        setTimeout(() => window.location.reload(), 1000);
      } else {
        // Production mode - redirect to OAuth
        window.location.href = authUrl;
      }
    } catch (error) {
      console.error('Error initiating Epic auth:', error);
      alert('Failed to connect to Epic: ' + error.message);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect from Epic? You will need to reconnect to access patient data.')) {
      return;
    }

    setDisconnecting(true);
    try {
      await disconnectEpic(doctorEmail);
      setConnected(false);
      alert('Successfully disconnected from Epic');
    } catch (error) {
      console.error('Error disconnecting from Epic:', error);
      alert('Failed to disconnect: ' + error.message);
    }
    setDisconnecting(false);
  };

  if (loading) {
    return (
      <div style={{
        padding: '1rem',
        background: '#f9fafb',
        borderRadius: '12px',
        border: '1px solid #e0e0e0',
        textAlign: 'center'
      }}>
        <p style={{ color: '#666', margin: 0 }}>Checking Epic connection...</p>
      </div>
    );
  }

  return (
    <div style={{
      padding: '1.5rem',
      background: connected ? 
        'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)' :
        'linear-gradient(135deg, rgba(232, 121, 249, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
      borderRadius: '12px',
      border: connected ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(232, 121, 249, 0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem'
    }}>
      {/* Left side - Status and Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
        {/* Epic Logo/Icon */}
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: connected ? '#10b981' : '#E879F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          color: 'white',
          fontWeight: '700',
          flexShrink: 0
        }}>
          {connected ? '✓' : 'E'}
        </div>

        {/* Status Text */}
        <div style={{ flex: 1 }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: '700',
            color: '#1a1a1a',
            marginBottom: '0.25rem'
          }}>
            Plasma FHIR Integration
          </h3>
          <p style={{
            fontSize: '0.95rem',
            color: connected ? '#059669' : '#666',
            margin: 0
          }}>
            {connected ? 
              '✓ Connected - Access patient data from Epic & other EHR systems' :
              'Not connected - Connect to pull patient data from Epic automatically'}
          </p>
        </div>
      </div>

      {/* Right side - Action Button */}
      <div>
        {connected ? (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'white',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              color: '#666',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: disconnecting ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              fontFamily: 'inherit',
              opacity: disconnecting ? 0.6 : 1
            }}
            onMouseOver={(e) => {
              if (!disconnecting) {
                e.target.style.borderColor = '#ef4444';
                e.target.style.color = '#ef4444';
              }
            }}
            onMouseOut={(e) => {
              if (!disconnecting) {
                e.target.style.borderColor = '#e0e0e0';
                e.target.style.color = '#666';
              }
            }}
          >
            {disconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #E879F9 0%, #A855F7 100%)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(232, 121, 249, 0.3)',
              fontFamily: 'inherit'
            }}
            onMouseOver={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 20px rgba(232, 121, 249, 0.4)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 12px rgba(232, 121, 249, 0.3)';
            }}
          >
            🔐 Connect to Plasma FHIR
          </button>
        )}
      </div>
    </div>
  );
}

export default EpicConnect;

