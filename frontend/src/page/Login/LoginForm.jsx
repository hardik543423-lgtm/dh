import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { preloadSecondaryPages } from '../../App.jsx';
import { API_URL } from '../../config.js';
import { useTheme } from '../../contexts/ThemeContext.jsx';

const superBrockerId = '9999912345';
const superBrockerPass = '7180';

const InputField = ({ iconClass, type, name, placeholder, value, onChange, error, isDark }) => (
  <div className="relative mb-5 group">
    <div className={`absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none transition-colors duration-200 ${isDark ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`}>
      <i className={iconClass}></i>
    </div>
    <input
      type={type}
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`w-full p-4 pl-12 rounded-xl transition-all duration-300 border outline-none backdrop-blur-sm ${
        isDark 
          ? `bg-white/5 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/50 ${error ? 'border-red-500' : 'border-white/10'} focus:border-indigo-500`
          : `bg-slate-50 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-600/20 ${error ? 'border-red-500' : 'border-slate-200'} focus:border-indigo-600 shadow-inner`
      }`}
      required
      autoComplete={name === 'password' ? 'current-password' : 'username'}
    />
    {error && <p className="text-red-500 text-[10px] mt-1 absolute -bottom-4 left-0 uppercase font-bold tracking-tighter">{error}</p>}
  </div>
);

const LoginForm = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [formData, setFormData] = useState({ identifier: '', password: '' });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiMessage, setApiMessage] = useState({ text: '', type: '' });



  const validate = (data) => {
    const newErrors = {};
    const digitRegex = /^\d{10}$/;
    const adminRegex = /^admin\d+$/; // Allow admin123, admin456, etc.

    // Translated validation messages
    if (!data.identifier) newErrors.identifier = 'Login ID is required.';
    else if (!digitRegex.test(data.identifier) && !adminRegex.test(data.identifier)) {
      newErrors.identifier = 'ID must be 10 digits or valid admin ID.';
    }

    if (!data.password) newErrors.password = 'Password is required.';

    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
    setApiMessage({ text: '', type: '' });
  };

  // ---- helper: compute final redirect
  const computeRedirect = (role, assocBrokerId) => {
    // Admin redirects to registration requests page
    if (role === 'admin') {
      return '/admin/registrations';
    }
    if (role === 'broker') {
      const id = assocBrokerId || localStorage.getItem('associatedBrokerStringId');
      return id ? `/broker/${id}/customerDetail` : '/customerDetail';
    }
    // customer
    return '/watchlist';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate(formData);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    setIsSubmitting(true);
    setApiMessage({ text: '', type: '' });

    // ✅ SUPER BROKER (local)
    if (formData.identifier === superBrockerId && formData.password === superBrockerPass) {
      const fakeToken = 'super-broker-local-token';
      const user = { id: formData.identifier, name: 'Super Broker', role: 'broker' };

      localStorage.setItem('token', fakeToken);
      localStorage.setItem('authToken', fakeToken);
      localStorage.setItem('loggedInUser', JSON.stringify(user));

      localStorage.setItem('associatedBrokerStringId', superBrockerId);

      axios.defaults.headers.common['Authorization'] = `Bearer ${fakeToken}`;

      // Preload secondary pages in background
      preloadSecondaryPages();

      navigate('/brockerDetail'); // polite React redirect

      setIsSubmitting(false);
      return;
    }

    const apiUrl = API_URL;
    console.log("[Login] API URL:", apiUrl); // Debug log to check env var
    try {
      const res = await axios.post(
        `${apiUrl}/api/auth/login`,
        formData
      );

      if (res.data?.success) {
        console.log('[LoginForm] Response Data:', res.data); // Debug Log
        const { name, role, token, associatedBrokerStringId, organizationName, defaultJobbing } = res.data;
        const user = { id: formData.identifier, name, role };

        console.log('[LoginForm] Organization Name extracted:', organizationName); // Debug Log

        if (organizationName) {
          localStorage.setItem('organizationName', organizationName);
        } else {
          console.warn('[LoginForm] Organization Name missing, using default.');
          localStorage.setItem('organizationName', 'DHANLAXMI');
        }

        localStorage.setItem('token', token);
        localStorage.setItem('authToken', token);
        localStorage.setItem('loggedInUser', JSON.stringify(user));
        if (associatedBrokerStringId) {
          localStorage.setItem('associatedBrokerStringId', associatedBrokerStringId);
          localStorage.setItem('activeContext', JSON.stringify({ brokerId: associatedBrokerStringId, customerId: user.id }));

        }

        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // Preload secondary pages in background
        preloadSecondaryPages();

        setApiMessage({ text: 'Login successful!', type: 'success' });

        // 🔁 CHANGED: broker -> /broker/:id/customerDetail ; customer -> /watchlist
        const redirectionPath = computeRedirect(role, associatedBrokerStringId);

        // Use navigate for smooth SPA transition instead of full reload
        setTimeout(() => {
          // Jobbing settings are now per-customer in database (FundModel.jobbing_settings)
          // No need to store in localStorage — frontend fetches from DB when needed

          navigate(redirectionPath, { replace: true });
        }, 600);
      } else {
        setApiMessage({ text: res.data?.message || 'Login failed.', type: 'error' });
      }
    } catch (err) {
      // Handle different error response formats
      const errorData = err.response?.data;
      let msg;

      if (err.response) {
        // Server responded with an error status
        msg = errorData?.message || errorData?.error || `Login failed (${err.response.status})`;
      } else if (err.request) {
        // Request made but no response received
        msg = 'Network error: Server unreachable. Please check your connection.';
      } else {
        // Something else went wrong
        msg = err.message || 'An unexpected error occurred.';
      }

      setApiMessage({ text: msg, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-['Inter'] ${isDark ? 'bg-[#06080f]' : 'bg-[#f8fafc]'}`}>
      {/* Background Ambient Orbs */}
      <div className={`absolute top-[-10%] right-[-5%] w-[500px] h-[500px] ${isDark ? 'bg-indigo-600/10' : 'bg-indigo-400/20'} rounded-full blur-[120px] pointer-events-none`} />
      <div className={`absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] ${isDark ? 'bg-purple-600/10' : 'bg-purple-400/20'} rounded-full blur-[120px] pointer-events-none`} />

      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        crossOrigin="anonymous"
      />

      <div
        className={`w-full max-w-sm p-8 backdrop-blur-xl rounded-3xl shadow-2xl border relative z-10 ${
          isDark 
            ? 'bg-slate-900/60 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]' 
            : 'bg-white/80 border-slate-200 shadow-[0_8px_32px_rgba(0,0,0,0.05)]'
        }`}
      >
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className={`absolute left-6 top-6 flex items-center gap-2 transition-all text-xs font-semibold uppercase tracking-wider group ${
            isDark ? 'text-slate-500 hover:text-white' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <i className="fas fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
          <span>Back to Home</span>
        </button>

        <div className="flex flex-col items-center justify-center mb-8 gap-3">
            <img src="/image.png" alt="DHANLAXMI" className={`h-16 object-contain rounded-xl ${isDark ? '' : 'shadow-sm drop-shadow-md'}`} />
        </div>

        <h1 className={`text-xl whitespace-nowrap font-black mb-2 text-center tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Welcome To DHANLAXMI</h1>
        <p className={`text-center mb-8 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Enter your credentials to access your account</p>

        {apiMessage.text && (
          <div
            className={`p-3 mb-6 rounded-xl font-medium text-sm text-center animate-in fade-in slide-in-from-top-2 duration-300 ${apiMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
          >
            {apiMessage.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-1">
          <InputField
            iconClass="fas fa-id-card"
            type="text"
            name="identifier"
            placeholder="10-Digit Login ID"
            value={formData.identifier}
            onChange={handleChange}
            error={errors.identifier}
            isDark={isDark}
          />
          <InputField
            iconClass="fas fa-lock"
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            isDark={isDark}
          />

          <button
            type="submit"
            className="w-full py-4 mt-4 rounded-xl text-base font-bold text-white uppercase bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 transition-all duration-300 shadow-lg shadow-indigo-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-circle-notch fa-spin"></i> <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <i className="fas fa-arrow-right text-xs opacity-70 group-hover:translate-x-1 transition-transform"></i>
              </>
            )}
          </button>
        </form>

        {/* Registration Link */}
        <div className={`mt-8 pt-6 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
          <p className={`text-center text-sm mb-4 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Don't have an account?</p>
          <button
            onClick={() => navigate('/register')}
            className={`w-full py-3 rounded-xl text-sm font-semibold border transition-all duration-300 flex items-center justify-center space-x-2 ${
              isDark 
                ? 'text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/10' 
                : 'text-indigo-600 border-indigo-200 hover:bg-indigo-50'
            }`}
          >
            <i className="fas fa-user-plus text-xs"></i>
            <span>Register as Partner</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;