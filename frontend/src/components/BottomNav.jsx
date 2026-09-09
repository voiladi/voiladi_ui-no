import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Compass, Heart, MessageCircle, UserRound } from "lucide-react";
import { useBadges } from "@/hooks/useBadges";

const TABS = [
  { to: "/discover", label: "Discover", icon: Compass, id: "discover" },
  { to: "/likes", label: "Likes", icon: Heart, id: "likes" },
  { to: "/chats", label: "Chats", icon: MessageCircle, id: "chats" },
  { to: "/profile", label: "You", icon: UserRound, id: "profile" },
];

/* Flat iOS tab bar: translucent, hairline on top, icon + label, tinted active state. */
export const BottomNav = () => {
  const { pathname } = useLocation();
  const { likes, unread } = useBadges();
  return (
    <nav
      data-testid="bottom-nav"
      className="vo-bar absolute inset-x-0 bottom-0 z-30 border-t border-line"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
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
                className={`relative flex h-full flex-col items-center justify-center gap-[3px] text-[10px] font-medium transition-colors duration-150 ease-ios focus-visible:outline-none active:opacity-60 ${
                  active ? "text-tint" : "text-mute2 hover:text-mute"
                }`}
              >
                <span className="relative">
                  <Icon className="h-[24px] w-[24px]" strokeWidth={active ? 2.2 : 1.8} fill={active && t.id === "likes" ? "currentColor" : "none"} />
                  {badge > 0 && (
                    <span data-testid={`bottom-nav-${t.id}-badge`} className="vo-badge absolute -right-2.5 -top-1.5">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                {t.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
