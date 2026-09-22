import React from 'react';
import { motion } from 'motion/react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', hover = true }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`glass rounded-2xl p-6 ${hover ? 'glass-hover' : ''} transition-all duration-300 ${className}`}
  >
    {children}
  </motion.div>
);

export const NeonButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'danger' | 'outline';
  disabled?: boolean;
}> = ({ children, onClick, className = '', variant = 'primary', disabled }) => {
  const variants = {
    primary: 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-600/40',
    danger: 'bg-red-600/20 border-red-500/50 text-red-400 hover:bg-red-600/40',
    outline: 'bg-transparent border-white/20 text-white/70 hover:border-white/40 hover:text-white',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-xl border transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export const VirtualLogo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <div className="relative w-10 h-10">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 border-2 border-emerald-500/30 rounded-lg"
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute inset-2 border-2 border-emerald-400/50 rounded-full"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-emerald-400 font-bold text-xl">C</span>
      </div>
    </div>
    <span className="text-2xl font-bold tracking-tighter neon-text">
      ClinIQ <span className="text-emerald-400">AI</span>
    </span>
  </div>
);

export const StatusBanner: React.FC<{
  type: 'warning' | 'error' | 'info';
  message: string;
  action?: { label: string; onClick: () => void };
}> = ({ type, message, action }) => {
  const styles = {
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    error: 'bg-red-500/10 border-red-500/20 text-red-400',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-2xl border flex items-center gap-4 mb-6 ${styles[type]}`}
    >
      <div className="flex-1">
        <p className="text-sm font-medium">{message}</p>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-xs font-bold uppercase tracking-widest"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
};
