import React from "react";
import { motion } from "framer-motion";
import { rise } from "@/lib/motion";

export const EmptyState = ({ icon: Icon, title, description, action, secondary, testId = "empty-state" }) => (
  <motion.div {...rise} className="flex flex-col items-center px-8 py-14 text-center" data-testid={testId}>
    {Icon && (
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-ink">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </span>
    )}
    <h3 className="mt-4 text-[17px] font-semibold text-ink">{title}</h3>
    {description && <p className="mt-1.5 max-w-[280px] text-[14px] leading-relaxed text-mute">{description}</p>}
    {action && <div className="mt-6 w-full max-w-[280px]">{action}</div>}
    {secondary && <div className="mt-2 w-full max-w-[280px]">{secondary}</div>}
  </motion.div>
);

/* Tab page header: logo lockup left, optional icon buttons right; large title underneath. */
export const PageHeader = ({ title, subtitle, right, brand, className = "", titleRight }) => (
  <header className={`px-5 pt-3 ${className}`}>
    {brand && (
      <div className="flex h-11 items-center justify-between">
        {brand}
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    )}
    {title && (
      <div className={`flex items-center justify-between ${brand ? "mt-2" : "mt-1"}`}>
        <h1 className="vo-title">{title}</h1>
        {titleRight}
      </div>
    )}
    {subtitle && <p className="mt-1 text-[14px] text-mute">{subtitle}</p>}
  </header>
);

/* Modal-style header: text button left, centred title, text button right. */
export const ModalHeader = ({ left, title, right, className = "" }) => (
  <header className={`vo-bar sticky top-0 z-20 grid h-14 grid-cols-[1fr_auto_1fr] items-center px-4 ${className}`}>
    <div className="flex justify-start">{left}</div>
    <h1 className="text-[17px] font-semibold text-ink">{title}</h1>
    <div className="flex justify-end">{right}</div>
  </header>
);

export { Skeleton, SkeletonRow, SkeletonList, SkeletonLines, Spinner, PageLoader } from "@/components/Loading";
