import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { SquareStack, Search, Heart, MessageCircle, User } from "lucide-react";
import { useBadges } from "@/hooks/useBadges";

const TABS = [
  { to: "/discover", label: "Discover", icon: SquareStack, id: "discover", fill: false },
  { to: "/explore", label: "Explore", icon: Search, id: "explore", fill: false },
  { to: "/likes", label: "Likes", icon: Heart, id: "likes", fill: true },
  { to: "/chats", label: "Chat", icon: MessageCircle, id: "chats", fill: true },
  { to: "/profile", label: "Profile", icon: User, id: "profile", fill: true },
];

/* Five tabs, white bar, hairline on top. Active tab: filled ink icon + semibold label. */
export const BottomNav = () => {
  const { pathname } = useLocation();
  const { likes, unread } = useBadges();
  return (
    <nav data-testid="bottom-nav" className="vo-bar absolute inset-x-0 bottom-0 z-30 border-t border-line" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="flex h-[58px] items-stretch">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.to);
          const Icon = t.icon;
          const badge = t.id === "likes" ? likes : t.id === "chats" ? unread : 0;
          return (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                data-testid={`bottom-nav-${t.id}`}
                aria-label={t.label}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-1 transition-colors duration-150 focus-visible:outline-none active:opacity-60 ${
                  active ? "text-ink" : "text-mute hover:text-ink2"
                }`}
              >
                <span className="relative">
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.75} fill={active && t.fill ? "currentColor" : "none"} />
                  {badge > 0 && (
                    <span data-testid={`bottom-nav-${t.id}-badge`} className="absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red px-1 text-[10px] font-semibold leading-none text-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                <span className={`text-[11px] leading-none ${active ? "font-semibold" : "font-medium"}`}>{t.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
