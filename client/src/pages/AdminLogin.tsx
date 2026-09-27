import React, { useState } from 'react';
import { Lock, ShieldCheck, KeyRound, Building2 } from 'lucide-react';
import { loginAdmin } from '../api/admin';

interface AdminLoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [securityCode, setSecurityCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!securityCode.trim()) {
      setErrorMsg('Please enter your Super Admin Security Code.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg('');
      const res = await loginAdmin(securityCode.trim());
      if (res.success && res.token) {
        localStorage.setItem('tpc_admin_token', res.token);
        onLoginSuccess(res.token, res.user);
      } else {
        setErrorMsg(res.message || 'Invalid Security Code!');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authorization failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 sm:p-10 w-full max-w-md text-center transition-all hover:shadow-2xl">
        {/* Brand Icon */}
        <div className="w-16 h-16 bg-[#041C32] text-[#F5D042] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
          <KeyRound className="w-8 h-8" />
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold text-[#041C32] tracking-tight">
          Admin Authorization
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-6">
          The Prime Classes • Branch Head / Super Admin Portal
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              value={securityCode}
              onChange={(e) => setSecurityCode(e.target.value)}
              placeholder="Enter Security Code"
              className="w-full text-center text-base sm:text-lg font-bold bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-800 tracking-wider placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#041C32] focus:bg-white transition-all"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-[#F5D042] text-[#041C32] font-black text-base rounded-xl hover:bg-[#e3be30] shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <span>Verifying Access...</span>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                <span>Authorize Access</span>
              </>
            )}
          </button>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-lg animate-shake">
              {errorMsg}
            </div>
          )}
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-[11px] text-slate-400">
          PostgreSQL Primary Architecture • Outbox Google Sheets Sync
        </div>
      </div>
    </div>
  );
};
