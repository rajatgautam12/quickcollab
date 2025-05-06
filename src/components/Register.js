import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  // Basic email regex for validation
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  // Validate form inputs
  const isFormValid = () => {
    if (!name.trim()) return 'Name is required';
    if (!isValidEmail(email)) return 'Please enter a valid email';
    if (password.length < 6) return 'Password must be at least 6 characters';
    return '';
  };

  // Clear error message after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.warn('REGISTRATION ATTEMPT - Email:', email);
    if (isSubmitting) return; // Prevent double submissions
    const validationError = isFormValid();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Registration failed';
      setError(errorMessage === 'User already exists'
        ? `User already exists for ${email}. Try a different email, log in, or run: curl -X DELETE "http://localhost:5000/auth/delete?email=${email}&secret=mydelete123"`
        : errorMessage);
      // Clear form fields on error
      setEmail('');
      setPassword('');
      setName('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dismissError = () => {
    setError('');
  };

  return (
    <div className="flex-center">
      <div className="card">
        <h2 className="text-2xl font-bold mb-6 text-center">Register</h2>
        {error && (
          <div
            className="text-error font-bold mb-4 shake"
            style={{
              textAlign: 'center',
              backgroundColor: '#ffe5e5',
              padding: '16px',
              borderRadius: '4px',
              border: '1px solid #dc3545',
              fontSize: '1.1rem',
              position: 'relative',
            }}
          >
            {error}
            <button
              onClick={dismissError}
              style={{
                position: 'absolute',
                right: '8px',
                top: '8px',
                background: 'none',
                border: 'none',
                color: '#dc3545',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              ✕
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-group"
              required
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-group"
              required
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-group"
              required
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            className="button button-blue"
            disabled={!!isFormValid() || isSubmitting}
          >
            {isSubmitting ? 'Registering...' : 'Register'}
          </button>
        </form>
        <p className="text-sm text-center mt-4">
          Already have an account? <a href="/login" className="text-blue-600 hover:underline">Log in</a>
        </p>
      </div>
    </div>
  );
}

export default Register;