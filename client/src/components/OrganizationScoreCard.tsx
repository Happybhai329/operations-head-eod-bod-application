import React from 'react';
import { Award, TrendingUp } from 'lucide-react';

interface OrganizationScoreCardProps {
  score: number;
  isLoading: boolean;
}

export const OrganizationScoreCard: React.FC<OrganizationScoreCardProps> = ({ score, isLoading }) => {
  let scoreColor = 'text-[#041C32]';
  let badgeColor = 'bg-slate-100 text-slate-700';

  if (score >= 80) {
    scoreColor = 'text-emerald-600';
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (score >= 50) {
    scoreColor = 'text-amber-600';
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (score > 0) {
    scoreColor = 'text-rose-600';
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
  }

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 text-center shadow-md border-t-8 border-[#041C32] relative overflow-hidden transition-all hover:shadow-lg">
      <div className="flex justify-center items-center gap-2 mb-2 text-slate-500 font-bold uppercase tracking-widest text-xs sm:text-sm">
        <Award className="w-4 h-4 text-[#F5D042]" />
        <span>Overall Organization Performance</span>
        <TrendingUp className="w-4 h-4 text-slate-400" />
      </div>

      <div className="my-2">
        {isLoading ? (
          <div className="text-5xl sm:text-7xl font-extrabold text-slate-300 animate-pulse">
            --%
          </div>
        ) : (
          <div className={`text-6xl sm:text-8xl font-black tracking-tight ${scoreColor} drop-shadow-sm transition-all`}>
            {score}%
          </div>
        )}
      </div>

      <div className="inline-block mt-2">
        <span className={`px-4 py-1 rounded-full text-xs font-bold border ${badgeColor}`}>
          {score >= 80
            ? '🌟 Excellent Overall Efficiency'
            : score >= 50
            ? '⚠️ Stable Performance'
            : '🚨 Critical Attention Required'}
        </span>
      </div>
    </div>
  );
};
