import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Copy, Search, Heart, MessageCircle, User } from "lucide-react";
import { useBadges } from "@/hooks/useBadges";

/* Icons as photographed: two overlapping cards (Discover), magnifier, heart, speech bubble, person. */
const TABS = [
  { to: "/discover", label: "Discover", icon: Copy, id: "discover", fill: false },
  { to: "/explore", label: "Explore", icon: Search, id: "explore", fill: false },
  { to: "/likes", label: "Likes", icon: Heart, id: "likes", fill: true },
  { to: "/chats", label: "Chat", icon: MessageCircle, id: "chats", fill: true },
  { to: "/profile", label: "Profile", icon: User, id: "profile", fill: true },
];

/* Floating rounded bar, inset 12px from the edges, raised on the canvas. Active tab: filled ink icon + semibold label. */
export const BottomNav = () => {
  const { pathname } = useLocation();
  const { likes, unread } = useBadges();
  return (
    <nav data-testid="bottom-nav" className="absolute inset-x-3 z-30" style={{ bottom: "calc(var(--nav-gap) + env(safe-area-inset-bottom, 0px))" }}>
      <ul className="vo-float-nav flex items-stretch rounded-[32px] px-1" style={{ height: "var(--nav-h)" }}>
        {TABS.map((t) => {
          const active = pathname.startsWith(t.to);
          const Icon = t.icon;
          const badge = t.id === "likes" ? likes : t.id === "chats" ? unread : 0;
          return (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                data-testid={`bottom-nav-${t.id}`}
                aria-label={badge > 0 ? `${t.label}, ${badge} new` : t.label}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-[5px] rounded-[26px] transition-colors duration-150 focus-visible:outline-none active:opacity-60 ${
                  active ? "text-ink" : "text-mute hover:text-ink2"
                }`}
              >
                <span className="relative">
                  <Icon className="h-6 w-6" strokeWidth={active ? 2 : 1.6} fill={active && t.fill ? "currentColor" : "none"} />
                  {badge > 0 && <span data-testid={`bottom-nav-${t.id}-badge`} className="absolute -right-1 -top-0.5 h-[9px] w-[9px] rounded-full bg-red ring-2 ring-bg" />}
                </span>
                <span className={`text-[12px] leading-none tracking-[-0.01em] ${active ? "font-semibold" : "font-normal"}`}>{t.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
