import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children, className = '', description }) => {
  return (
    <div
      className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7 lg:p-8 text-slate-100 shadow-[0_18px_45px_rgba(12,18,30,0.45)] backdrop-blur-xl transition duration-300 hover:border-white/20 hover:bg-white/10 hover:shadow-[0_22px_60px_rgba(17,24,39,0.55)] ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute -top-28 right-0 h-48 w-48 rounded-full bg-gradient-to-br from-indigo-500/30 via-fuchsia-500/20 to-rose-400/20 blur-3xl" />
        <div className="absolute -bottom-32 left-0 h-56 w-56 rounded-full bg-gradient-to-tr from-sky-500/20 via-purple-500/10 to-indigo-400/20 blur-3xl" />
      </div>
      <div className="relative mb-5 space-y-2">
        <h3 className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70 shadow-inner shadow-white/10">
          {title}
        </h3>
        {description && (
          <div className="text-sm text-white/60">
            {description}
          </div>
        )}
      </div>
      <div className="relative">
        {children}
      </div>
    </div>
  );
};

export default Card;
