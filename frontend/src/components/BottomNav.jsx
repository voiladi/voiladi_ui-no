import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Compass, Heart, MessageCircle, UserRound } from "lucide-react";
import { useBadges } from "@/hooks/useBadges";

const TABS = [
  { to: "/discover", label: "Discover", icon: Compass, id: "discover" },
  { to: "/likes", label: "Likes", icon: Heart, id: "likes" },
  { to: "/chats", label: "Chats", icon: MessageCircle, id: "chats" },
  { to: "/profile", label: "You", icon: UserRound, id: "profile" },
];

export const BottomNav = () => {
  const { pathname } = useLocation();
  const { likes, unread } = useBadges();
  return (
    <nav
      data-testid="bottom-nav"
      className="absolute bottom-3 left-1/2 z-30 w-[calc(100%-24px)] -translate-x-1/2 rounded-full border border-line bg-white/95 p-1.5 shadow-[0_12px_34px_rgba(11,18,32,0.12)] backdrop-blur-md"
      style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}
    >
      <ul className="relative flex items-center">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.to);
          const Icon = t.icon;
          const badge = t.id === "likes" ? likes : t.id === "chats" ? unread : 0;
          return (
            <li key={t.to} className="relative flex-1">
              <NavLink
                to={t.to}
                data-testid={`bottom-nav-${t.id}`}
                className="relative flex h-12 items-center justify-center gap-2 rounded-full text-[13px] font-semibold"
                aria-label={t.label}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-nav-indicator"
                    className="absolute inset-0 rounded-full bg-ink"
                    transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.9 }}
                  />
                )}
                <span className={`relative z-10 flex items-center gap-1.5 ${active ? "text-white" : "text-mute"}`}>
                  <Icon className="h-[20px] w-[20px]" strokeWidth={active ? 2.4 : 2} />
                  {active && (
                    <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="pr-1">
                      {t.label}
                    </motion.span>
                  )}
                </span>
                {badge > 0 && (
                  <span
                    data-testid={`bottom-nav-${t.id}-badge`}
                    className={`absolute right-2.5 top-1.5 z-20 vo-badge ${active ? "bg-peach text-ink" : ""}`}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
