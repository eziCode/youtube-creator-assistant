import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ title, children, className = '' }) => {
  return (
    <div className={`bg-slate-50 rounded-lg p-4 ${className}`}>
      <h3 className="text-sm font-medium text-slate-500 mb-2">{title}</h3>
      {children}
    </div>
  );
};

export default Card;
