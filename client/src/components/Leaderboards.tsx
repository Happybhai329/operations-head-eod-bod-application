import React from 'react';
import { Trophy, AlertTriangle, Medal, AlertCircle, User, Building } from 'lucide-react';
import { EmployeeLeaderboardItem, HeadLeaderboardItem } from '../types/admin';

interface LeaderboardsProps {
  topEmps: EmployeeLeaderboardItem[];
  bottomEmps: EmployeeLeaderboardItem[];
  topHeads: HeadLeaderboardItem[];
  bottomHeads: HeadLeaderboardItem[];
  isLoading: boolean;
}

export const Leaderboards: React.FC<LeaderboardsProps> = ({
  topEmps,
  bottomEmps,
  topHeads,
  bottomHeads,
  isLoading,
}) => {
  return (
    <div className="space-y-6">
      {/* 1. EMPLOYEE PERFORMANCE ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Employees */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-3">
            <Trophy className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">
              🏆 Top Performers (Employees)
            </h3>
          </div>

          <div className="space-y-2">
            {isLoading ? (
              <div className="text-center py-6 text-slate-400 text-xs animate-pulse">Loading rankings...</div>
            ) : topEmps.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs italic">No employee data in period</div>
            ) : (
              topEmps.map((emp, i) => (
                <div
                  key={emp.empId}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100/80 hover:bg-emerald-50 transition-all"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="font-black text-xs px-2 py-0.5 rounded bg-emerald-600 text-white">
                      #{i + 1}
                    </span>
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-slate-800">{emp.name}</div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {emp.dept} • <span className="font-mono text-slate-400">{emp.empId}</span>
                      </div>
                    </div>
                  </div>
                  <span className="font-black text-xs sm:text-sm px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow-sm">
                    {emp.score}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bottom Employees */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">
              ⚠️ Need Attention (Employees)
            </h3>
          </div>

          <div className="space-y-2">
            {isLoading ? (
              <div className="text-center py-6 text-slate-400 text-xs animate-pulse">Loading rankings...</div>
            ) : bottomEmps.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs italic">No employee data in period</div>
            ) : (
              bottomEmps.map((emp) => (
                <div
                  key={emp.empId}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-rose-50/50 border border-rose-100/80 hover:bg-rose-50 transition-all"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="font-black text-xs px-2 py-0.5 rounded bg-rose-600 text-white">
                      🔻
                    </span>
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-slate-800">{emp.name}</div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {emp.dept} • <span className="font-mono text-slate-400">{emp.empId}</span>
                      </div>
                    </div>
                  </div>
                  <span className="font-black text-xs sm:text-sm px-2.5 py-1 rounded-full bg-rose-600 text-white shadow-sm">
                    {emp.score}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 2. HEAD & DEPARTMENT PERFORMANCE ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Heads */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/20">
          <div className="flex items-center space-x-2 border-b border-indigo-100 pb-3 mb-3">
            <Medal className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-indigo-950 text-sm sm:text-base">
              🏅 Top Heads & Departments
            </h3>
          </div>

          <div className="space-y-2">
            {isLoading ? (
              <div className="text-center py-6 text-slate-400 text-xs animate-pulse">Loading head matrix...</div>
            ) : topHeads.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs italic">No head records available</div>
            ) : (
              topHeads.map((head, i) => (
                <div
                  key={head.department}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100 hover:bg-indigo-100/50 transition-all"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="font-black text-xs px-2 py-0.5 rounded bg-indigo-600 text-white">
                      #{i + 1}
                    </span>
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-slate-900">
                        {head.headName || 'Head Not Assigned'}
                      </div>
                      <div className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1">
                        <Building className="w-3 h-3" />
                        <span>{head.department}</span>
                      </div>
                    </div>
                  </div>
                  <span className="font-black text-xs sm:text-sm px-2.5 py-1 rounded-full bg-indigo-600 text-white shadow-sm">
                    {head.score}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bottom Heads */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-amber-100 bg-gradient-to-br from-white to-amber-50/20">
          <div className="flex items-center space-x-2 border-b border-amber-100 pb-3 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-amber-950 text-sm sm:text-base">
              ⚠️ Need Attention (Heads)
            </h3>
          </div>

          <div className="space-y-2">
            {isLoading ? (
              <div className="text-center py-6 text-slate-400 text-xs animate-pulse">Loading head matrix...</div>
            ) : bottomHeads.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs italic">No head records available</div>
            ) : (
              bottomHeads.map((head) => (
                <div
                  key={head.department}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 hover:bg-amber-100/50 transition-all"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="font-black text-xs px-2 py-0.5 rounded bg-amber-500 text-white">
                      🔻
                    </span>
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-slate-900">
                        {head.headName || 'Head Not Assigned'}
                      </div>
                      <div className="text-[11px] text-amber-800 font-semibold flex items-center gap-1">
                        <Building className="w-3 h-3" />
                        <span>{head.department}</span>
                      </div>
                    </div>
                  </div>
                  <span className="font-black text-xs sm:text-sm px-2.5 py-1 rounded-full bg-amber-500 text-white shadow-sm">
                    {head.score}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
