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

/* Five tabs, white bar, hairline on top. Active tab: filled ink icon + semibold label. New activity: plain red dot. */
export const BottomNav = () => {
  const { pathname } = useLocation();
  const { likes, unread } = useBadges();
  return (
    <nav data-testid="bottom-nav" className="vo-bar absolute inset-x-0 bottom-0 z-30 border-t border-line" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="flex h-[62px] items-stretch">
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
                className={`relative flex h-full flex-col items-center justify-center gap-[5px] transition-colors duration-150 focus-visible:outline-none active:opacity-60 ${
                  active ? "text-ink" : "text-mute hover:text-ink2"
                }`}
              >
                <span className="relative">
                  <Icon className="h-[27px] w-[27px]" strokeWidth={active ? 2.1 : 1.7} fill={active && t.fill ? "currentColor" : "none"} />
                  {badge > 0 && <span data-testid={`bottom-nav-${t.id}-badge`} className="absolute -right-1 -top-0.5 h-[9px] w-[9px] rounded-full bg-red ring-2 ring-bg" />}
                </span>
                <span className={`text-[13px] leading-none tracking-[-0.01em] ${active ? "font-semibold" : "font-medium"}`}>{t.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
