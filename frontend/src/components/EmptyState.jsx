import React from "react";
import { motion } from "framer-motion";
import { rise } from "@/lib/motion";

export const EmptyState = ({ icon: Icon, title, description, action, secondary, testId = "empty-state" }) => (
  <motion.div {...rise} className="flex flex-col items-center px-8 py-14 text-center" data-testid={testId}>
    {Icon && (
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-card bg-surface2 text-ink">
        <Icon className="h-7 w-7" strokeWidth={1.75} />
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
        <h1 className="vo-h1 truncate">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[14px] text-mute">{subtitle}</p>}
      </div>
    </div>
    {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
  </header>
);

export const Skeleton = ({ className = "" }) => <div className={`vo-shimmer rounded-card ${className}`} data-testid="loading-skeleton" />;
