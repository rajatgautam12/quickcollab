import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import styles from './Register.module.css';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isFormValid = () => {
    if (!name.trim()) return 'Name is required';
    if (!isValidEmail(email)) return 'Please enter a valid email';
    if (password.length < 6) return 'Password must be at least 6 characters';
    return '';
  };

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.warn('REGISTRATION ATTEMPT - Email:', email);
    if (isSubmitting) return;
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
      setEmail('');
      setPassword('');
      setName('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>Register for QuickCollab</h2>
        {error && (
          <div className={`${styles.error} ${styles.shake}`}>
            {error}
            <button onClick={() => setError('')} className={styles.closeError}>✕</button>
          </div>
        )}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
              required
              autoComplete="off"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              required
              autoComplete="off"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              required
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            className={styles.button}
            disabled={!!isFormValid() || isSubmitting}
          >
            {isSubmitting ? 'Registering...' : 'Register'}
          </button>
        </form>
        <p className={styles.link}>
          Already have an account? <a href="/login" className={styles.linkText}>Log in</a>
        </p>
      </div>
    </div>
  );
}

export default Register;