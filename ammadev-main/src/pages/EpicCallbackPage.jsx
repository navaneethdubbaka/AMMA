import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleEpicCallback } from '../utils/epicClient';

function EpicCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Connecting to Epic...');

  useEffect(() => {
    processCallback();
  }, []);

  const processCallback = async () => {
    try {
      // Get code and state from URL parameters
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Check for OAuth errors
      if (error) {
        setStatus('error');
        setMessage(`Epic authorization failed: ${errorDescription || error}`);
        console.error('Epic OAuth error:', error, errorDescription);
        setTimeout(() => navigate('/doctor'), 3000);
        return;
      }

      // Validate parameters
      if (!code) {
        setStatus('error');
        setMessage('No authorization code received from Epic');
        setTimeout(() => navigate('/doctor'), 3000);
        return;
      }

      if (!state) {
        setStatus('error');
        setMessage('No state parameter received - possible security issue');
        setTimeout(() => navigate('/doctor'), 3000);
        return;
      }

      setMessage('Exchanging authorization code for access token...');

      // Handle the callback and store tokens
      const result = await handleEpicCallback(code, state);

      if (result.success) {
        setStatus('success');
        setMessage('Successfully connected to Epic! Redirecting...');
        console.log('✅ Epic connection successful');
        
        // Redirect to doctor profile after 2 seconds
        setTimeout(() => navigate('/doctor'), 2000);
      } else {
        throw new Error('Callback processing failed');
      }

    } catch (error) {
      console.error('❌ Epic callback error:', error);
      setStatus('error');
      setMessage(`Connection failed: ${error.message}`);
      setTimeout(() => navigate('/doctor'), 4000);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fafafa',
      padding: '2rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '3rem 2rem',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e0e0e0'
      }}>
        {/* Status Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          margin: '0 auto 2rem',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3rem',
          background: status === 'processing' ? 'linear-gradient(135deg, #E879F9 0%, #A855F7 100%)' :
                      status === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' :
                      'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: 'white',
          animation: status === 'processing' ? 'spin 2s linear infinite' : 'none'
        }}>
          {status === 'processing' && '⏳'}
          {status === 'success' && '✅'}
          {status === 'error' && '❌'}
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '800',
          marginBottom: '1rem',
          color: '#1a1a1a',
          fontFamily: 'Plus Jakarta Sans, sans-serif'
        }}>
          {status === 'processing' && 'Connecting to Epic...'}
          {status === 'success' && 'Connection Successful!'}
          {status === 'error' && 'Connection Failed'}
        </h1>

        {/* Message */}
        <p style={{
          fontSize: '1.125rem',
          color: '#666',
          lineHeight: '1.7',
          marginBottom: '2rem'
        }}>
          {message}
        </p>

        {/* Progress indicator */}
        {status === 'processing' && (
          <div style={{
            width: '100%',
            height: '4px',
            background: '#f0f0f0',
            borderRadius: '2px',
            overflow: 'hidden',
            marginBottom: '1rem'
          }}>
            <div style={{
              width: '50%',
              height: '100%',
              background: 'linear-gradient(135deg, #E879F9 0%, #A855F7 100%)',
              animation: 'progress 1.5s ease-in-out infinite'
            }} />
          </div>
        )}

        {/* Error - Show button to go back */}
        {status === 'error' && (
          <button
            onClick={() => navigate('/doctor')}
            style={{
              padding: '1rem 2rem',
              background: 'linear-gradient(135deg, #E879F9 0%, #A855F7 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '1rem',
              fontFamily: 'inherit'
            }}
          >
            Return to Dashboard
          </button>
        )}

        {/* Success note */}
        {status === 'success' && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            <p style={{
              fontSize: '0.95rem',
              color: '#059669',
              margin: 0
            }}>
              You can now access patient data from Epic EHR system
            </p>
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes progress {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
      `}</style>
    </div>
  );
}

export default EpicCallbackPage;

