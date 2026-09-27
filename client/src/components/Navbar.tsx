import React from 'react';
import { ShieldCheck, LogOut, Building2 } from 'lucide-react';

interface NavbarProps {
  isAuthenticated: boolean;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isAuthenticated, onLogout }) => {
  return (
    <header className="bg-[#041C32] text-white shadow-lg sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="bg-[#F5D042] text-[#041C32] p-2 rounded-lg font-black text-xl tracking-wider flex items-center gap-1.5 shadow-sm">
            <Building2 className="w-5 h-5" />
            <span>TPC</span>
          </div>
          <div>
            <span className="font-extrabold tracking-wide text-lg sm:text-xl">THE PRIME CLASSES</span>
            <span className="text-[#F5D042] font-bold text-xs sm:text-sm ml-2.5 px-2 py-0.5 rounded bg-white/10 tracking-widest uppercase">
              Branch Head Panel
            </span>
          </div>
        </div>

        {/* Right side controls */}
        {isAuthenticated && (
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>SUPER ADMIN AUTHORIZED</span>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border border-white/30 text-white hover:bg-white/10 hover:border-white transition-all shadow-sm"
              title="Secure Logout"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
