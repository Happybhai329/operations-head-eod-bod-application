import React from 'react';
import { ShieldCheck, LogOut, Building2 } from 'lucide-react';

interface NavbarProps {
  isAuthenticated: boolean;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isAuthenticated, onLogout }) => {
  return (
    <header className="bg-[#041C32] text-white shadow-md sticky top-0 z-40 pt-safe">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <div className="bg-[#F5D042] text-[#041C32] p-1.5 sm:p-2 rounded-lg font-black text-sm sm:text-xl tracking-wider flex items-center gap-1 shadow-xs shrink-0">
            <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>TPC</span>
          </div>
          <div className="min-w-0 flex flex-col sm:flex-row sm:items-center">
            <span className="font-extrabold tracking-wide text-sm sm:text-lg lg:text-xl truncate text-white">
              THE PRIME CLASSES
            </span>
            <span className="text-[#F5D042] font-bold text-[10px] sm:text-xs sm:ml-2.5 px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded bg-white/10 tracking-wider uppercase inline-block w-fit">
              Branch Head
            </span>
          </div>
        </div>

        {/* Right side controls */}
        {isAuthenticated && (
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <div className="hidden md:flex items-center space-x-1.5 bg-white/10 px-2.5 py-1 rounded-full text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>SUPER ADMIN</span>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/20 sm:border-white/30 text-white hover:bg-white/10 hover:border-white active:bg-white/20 transition-all shadow-2xs"
              title="Secure Logout"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-300 sm:text-white" />
              <span className="hidden xs:inline sm:inline">Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
