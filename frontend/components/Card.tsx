import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children, className = '', description }) => {
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm ${className}`}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{title}</h3>
        {description && <div className="text-xs text-slate-400 mt-1">{description}</div>}
      </div>
      {children}
    </div>
  );
};

export default Card;
