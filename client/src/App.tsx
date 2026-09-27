import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('tpc_admin_token');
  });

  useEffect(() => {
    const handleLogoutEvent = () => {
      setIsAuthenticated(false);
    };

    window.addEventListener('tpc_auth_logout', handleLogoutEvent);
    return () => window.removeEventListener('tpc_auth_logout', handleLogoutEvent);
  }, []);

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem('tpc_admin_token', token);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('tpc_admin_token');
    setIsAuthenticated(false);
  };

  return (
    <div className="min-h-screen bg-[#F4F7F6] text-slate-800 flex flex-col font-sans">
      <Navbar isAuthenticated={isAuthenticated} onLogout={handleLogout} />

      <main className="flex-1">
        {!isAuthenticated ? (
          <AdminLogin onLoginSuccess={handleLoginSuccess} />
        ) : (
          <AdminDashboard />
        )}
      </main>

      <footer className="py-4 border-t border-slate-200 text-center text-xs text-slate-400 bg-white">
        © {new Date().getFullYear()} The Prime Classes • Super Admin & Branch Head Performance Architecture
      </footer>
    </div>
  );
}

export default App;
