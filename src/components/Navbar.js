import React, { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import styles from './Navbar.module.css';

function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>
        <NavLink to="/">QuickCollab</NavLink>
      </div>
      <ul className={styles.navLinks}>
        <li>
          <NavLink to="/" className={({ isActive }) => isActive ? styles.active : ''}>Home</NavLink>
        </li>
        {!user ? (
          <>
            <li>
              <NavLink to="/login" className={({ isActive }) => isActive ? styles.active : ''}>Login</NavLink>
            </li>
            <li>
              <NavLink to="/register" className={({ isActive }) => isActive ? styles.active : ''}>Register</NavLink>
            </li>
          </>
        ) : (
          <>
            <li>
              <NavLink to="/dashboard" className={({ isActive }) => isActive ? styles.active : ''}>Dashboard</NavLink>
            </li>
            <li>
              <button onClick={handleLogout} className={styles.logoutButton}>Logout</button>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}

export default Navbar;