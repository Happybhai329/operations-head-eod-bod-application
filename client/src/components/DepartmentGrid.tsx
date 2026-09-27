import React from 'react';
import { DepartmentMetric } from '../types/admin';
import { Building2, User, ChevronRight, BarChart3 } from 'lucide-react';

interface DepartmentGridProps {
  departments: DepartmentMetric[];
  onSelectDepartment: (deptName: string, headId: string | null) => void;
  isLoading: boolean;
}

export const DepartmentGrid: React.FC<DepartmentGridProps> = ({
  departments,
  onSelectDepartment,
  isLoading,
}) => {
  return (
    <div className="mt-8">
      <div className="flex items-center space-x-2 mb-4">
        <BarChart3 className="w-5 h-5 text-[#041C32]" />
        <h3 className="text-lg sm:text-xl font-extrabold text-[#041C32]">
          Department & Head Analytics
        </h3>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 h-36 animate-pulse"
            >
              <div className="h-4 bg-slate-200 rounded w-2/3 mb-3"></div>
              <div className="h-3 bg-slate-100 rounded w-1/2 mb-6"></div>
              <div className="h-6 bg-slate-200 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      ) : departments.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center text-slate-400 border border-slate-200">
          No departments found in Database.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((dept) => {
            let borderClass = 'border-l-4 border-slate-300';
            let scoreColor = 'text-slate-400';
            let hoverBg = 'hover:border-[#F5D042]';

            if (dept.hasData) {
              if (dept.score >= 80) {
                borderClass = 'border-l-4 border-emerald-500';
                scoreColor = 'text-emerald-600';
              } else if (dept.score >= 50) {
                borderClass = 'border-l-4 border-amber-500';
                scoreColor = 'text-amber-600';
              } else {
                borderClass = 'border-l-4 border-rose-500';
                scoreColor = 'text-rose-600';
              }
            }

            return (
              <div
                key={dept.department}
                onClick={() => onSelectDepartment(dept.department, dept.headId)}
                className={`bg-white rounded-xl p-5 shadow-sm border border-slate-200 ${borderClass} ${hoverBg} hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between group`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-slate-800 text-base sm:text-lg group-hover:text-indigo-900 transition-colors">
                      {dept.department}
                    </h4>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#F5D042] group-hover:translate-x-0.5 transition-all" />
                  </div>

                  <div className="flex items-center space-x-1.5 text-xs text-slate-500 mt-1 mb-4">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Head: <strong className="text-slate-700">{dept.headName || 'Not Assigned'}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-end justify-between pt-3 border-t border-slate-100 mt-auto">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Dept Average
                  </span>
                  <div className={`text-2xl sm:text-3xl font-black ${scoreColor}`}>
                    {dept.hasData ? `${dept.score}%` : 'N/A'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
