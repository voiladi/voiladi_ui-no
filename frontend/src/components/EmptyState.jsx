import React from "react";
import { motion } from "framer-motion";

export const EmptyState = ({ icon: Icon, title, description, action, secondary, testId = "empty-state" }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="flex flex-col items-center px-8 py-14 text-center"
    data-testid={testId}
  >
    {Icon && (
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] bg-brand-soft text-brand-dark">
        <Icon className="h-9 w-9" strokeWidth={1.8} />
      </div>
    )}
    <h3 className="vo-h2 mb-2">{title}</h3>
    {description && <p className="mb-6 max-w-[280px] text-[15px] leading-relaxed text-mute">{description}</p>}
    {action}
    {secondary && <div className="mt-3">{secondary}</div>}
  </motion.div>
);

export const PageHeader = ({ title, subtitle, left, right, className = "" }) => (
  <header className={`flex items-center justify-between gap-3 px-5 pt-5 pb-3 ${className}`}>
    <div className="flex min-w-0 items-center gap-3">
      {left}
      <div className="min-w-0">
        <h1 className="vo-h1 truncate text-[28px]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[14px] text-mute">{subtitle}</p>}
      </div>
    </div>
    {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
  </header>
);

export const Skeleton = ({ className = "" }) => <div className={`vo-shimmer rounded-[14px] ${className}`} data-testid="loading-skeleton" />;
