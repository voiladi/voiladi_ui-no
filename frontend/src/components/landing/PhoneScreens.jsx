import React from "react";
import { Search, SlidersHorizontal, SquarePen, Bell, Settings, Camera, Heart, Copy, MessageCircle, User, Zap, Star, Crown, Lock, CircleHelp, ChevronRight, Wifi } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { BubblesArt, CardsArt } from "@/components/SoftUI";

/*
 * Static replicas of the app's screens for the landing-page phone carousel (Explore / Messages / Likes / Profile).
 * Laid out at a fixed 390px design width and scaled into the phone frame by the parent - purely decorative.
 */

const U = (id, w = 600) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;
const TILES = [
  ["Design", "128K members", U("1497215728101-856f4ea42174")],
  ["Travel", "95K members", U("1613395877344-13d4a8e0d49e")],
  ["Music", "212K members", U("1511379938547-c1f69419868d")],
  ["Fitness", "87K members", U("1571019613454-1cb2f99b2d8b")],
];
const PEOPLE = [
  ["Maya Torres", "Photographer", U("1494790108377-be9c29b29330", 160)],
  ["Alex Chen", "Content creator", U("1507003211169-0a1dd7228f2d", 160)],
  ["Priya Shah", "Product Designer", U("1534528741775-53994a69daeb", 160)],
];

const StatusBar = () => (
  <div className="flex h-[44px] items-center justify-between px-6 pt-2 text-[15px] font-semibold text-ink">
    <span>9:41</span>
    <span className="flex items-center gap-1.5">
      <span className="flex items-end gap-[2px]" aria-hidden="true">
        {[5, 7, 9, 11].map((h) => (
          <span key={h} className="w-[3px] rounded-[1px] bg-ink" style={{ height: h }} />
        ))}
      </span>
      <Wifi className="h-[15px] w-[15px]" strokeWidth={2.4} />
      <span className="relative ml-0.5 h-[11px] w-[24px] rounded-[3px] border-[1.5px] border-ink" aria-hidden="true">
        <span className="absolute inset-[1.5px] rounded-[1.5px] bg-ink" />
      </span>
    </span>
  </div>
);

const Header = ({ icons }) => (
  <div className="flex items-center justify-between px-5 pt-1">
    <span className="flex items-center gap-2.5">
      <LogoMark size={44} />
      <span className="text-[30px] font-extrabold leading-none tracking-[-0.035em] text-ink">voiladi</span>
    </span>
    <span className="flex gap-2.5">
      {icons.map((Icon, i) => (
        <span key={i} className="vo-soft-icon h-[46px] w-[46px]">
          <Icon className="h-[21px] w-[21px]" strokeWidth={1.9} />
        </span>
      ))}
    </span>
  </div>
);

const Title = ({ title, sub, right }) => (
  <div className="mt-3 flex items-end justify-between px-5">
    <span>
      <span className="block text-[34px] font-bold leading-[1.05] tracking-[-0.03em] text-ink">{title}</span>
      <span className="mt-1 block text-[15.5px] text-mute">{sub}</span>
    </span>
    {right}
  </div>
);

const Seg = ({ items, active }) => (
  <div className="vo-soft-sunken mx-5 mt-4 flex h-[46px] items-center rounded-full p-1">
    {items.map((t) => (
      <span key={t} className={`flex h-full flex-1 items-center justify-center whitespace-nowrap px-2 text-[14px] ${t === active ? "rounded-full bg-white font-semibold text-ink shadow-[0_2px_8px_rgba(0,0,0,0.08)]" : "text-mute"}`}>
        {t}
      </span>
    ))}
  </div>
);

const NAV = [
  ["Discover", Copy],
  ["Explore", Search],
  ["Likes", Heart],
  ["Chat", MessageCircle],
  ["Profile", User],
];
const Nav = ({ active }) => (
  <div className="absolute inset-x-0 bottom-0">
    <div className="mx-4 mb-2 flex h-[64px] items-center justify-around rounded-[26px] bg-white/85 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
      {NAV.map(([label, Icon]) => {
        const on = label === active;
        return (
          <span key={label} className={`flex flex-col items-center gap-1 text-[11.5px] ${on ? "font-bold text-ink" : "text-mute"}`}>
            <span className={`flex h-[34px] w-[34px] items-center justify-center rounded-full ${on ? "bg-ink text-white" : ""}`}>
              <Icon className="h-[22px] w-[22px]" strokeWidth={on ? 2.2 : 1.7} fill={on && (label === "Likes" || label === "Chat") ? "currentColor" : "none"} />
            </span>
            {label}
          </span>
        );
      })}
    </div>
    <div className="mx-auto mb-1.5 h-[4px] w-[120px] rounded-full bg-ink" />
  </div>
);

/* ---------------------------------------------------------------- screens */

export const ExploreScreen = () => (
  <div className="vo-neu-page relative h-full w-full overflow-hidden">
    <StatusBar />
    <Header icons={[Search, SlidersHorizontal]} />
    <Title title="Explore" sub="Find people, interests, and communities" />
    <div className="vo-soft mx-5 mt-4 flex h-[50px] items-center gap-3 rounded-full px-5 text-[15px] text-mute">
      <Search className="h-5 w-5" strokeWidth={2} /> Search people, interests, or communities
    </div>
    <Seg items={["People", "Topics", "Nearby", "Creators"]} active="People" />
    <div className="mt-4 flex items-center justify-between px-5">
      <span className="text-[19px] font-bold tracking-[-0.02em] text-ink">Trending now</span>
      <span className="text-[14px] text-mute">See all</span>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-3 px-5">
      {TILES.map(([name, members, img]) => (
        <div key={name} className="relative h-[88px] overflow-hidden rounded-[18px] bg-surface">
          <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <span className="absolute bottom-2.5 left-3 text-white">
            <span className="block text-[17px] font-bold leading-tight">{name}</span>
            <span className="block text-[12px] opacity-90">{members}</span>
          </span>
        </div>
      ))}
    </div>
    <div className="mt-4 flex items-center justify-between px-5">
      <span className="text-[19px] font-bold tracking-[-0.02em] text-ink">Suggested for you</span>
      <span className="text-[14px] text-mute">See all</span>
    </div>
    <div className="mt-2 px-5">
      {PEOPLE.map(([name, job, img]) => (
        <div key={name} className="flex items-center gap-3 py-1.5">
          <img src={img} alt="" className="h-[42px] w-[42px] rounded-full object-cover" loading="lazy" />
          <span className="flex-1">
            <span className="block text-[16px] font-semibold text-ink">{name}</span>
            <span className="block text-[13px] text-mute">{job}</span>
          </span>
          <span className="vo-soft rounded-full px-5 py-2 text-[14px] font-semibold text-ink">Follow</span>
        </div>
      ))}
    </div>
    <Nav active="Explore" />
  </div>
);

const Empty = ({ art, title, sub, action, ActionIcon, footer }) => (
  <div className="vo-soft mx-5 mt-4 flex flex-col items-center rounded-[28px] px-6 pb-7 pt-8 text-center">
    <div className="scale-[1.15]">{art}</div>
    <span className="mt-6 text-[21px] font-bold tracking-[-0.02em] text-ink">{title}</span>
    <span className="mt-1.5 text-[14.5px] leading-[19px] text-mute">{sub}</span>
    <span className="vo-soft mt-6 inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full text-[16px] font-semibold text-ink">
      <ActionIcon className="h-5 w-5" strokeWidth={2.2} /> {action}
    </span>
    <span className="mt-4 text-[13.5px] text-mute">{footer}</span>
  </div>
);

export const MessagesScreen = () => (
  <div className="vo-neu-page relative h-full w-full overflow-hidden">
    <StatusBar />
    <Header icons={[Search, SquarePen]} />
    <Title title="Messages" sub="Your conversations" />
    <Seg items={["All", "Matches", "Unread"]} active="All" />
    <Empty art={<BubblesArt />} title="No conversations yet" sub={"When you match, you can start\na conversation here."} action="Find people" ActionIcon={Search} footer="Start something new" />
    <Nav active="Chat" />
  </div>
);

export const LikesScreen = () => (
  <div className="vo-neu-page relative h-full w-full overflow-hidden">
    <StatusBar />
    <Header icons={[Search, SlidersHorizontal]} />
    <Title
      title="Likes"
      sub="People who liked you"
      right={
        <span className="vo-soft mb-1 inline-flex h-[40px] items-center gap-2 rounded-full px-4 text-[15px] font-semibold text-ink">
          <Heart className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} /> 0
        </span>
      }
    />
    <Seg items={["All", "Likes you", "You liked"]} active="All" />
    <Empty art={<CardsArt />} title="No likes yet" sub={"When someone likes you, they'll\nshow up here."} action="Explore people" ActionIcon={Copy} footer="New connections are waiting" />
    <Nav active="Likes" />
  </div>
);

const Row = ({ Icon, title, sub, value, last }) => (
  <div className={`flex items-center gap-3 px-4 py-2.5 ${last ? "" : "border-b border-line/70"}`}>
    <Icon className="h-[20px] w-[20px] text-ink" strokeWidth={1.9} />
    <span className="flex-1">
      <span className="block text-[15px] font-semibold text-ink">{title}</span>
      {sub && <span className="block text-[12px] text-mute">{sub}</span>}
    </span>
    {value && <span className="vo-soft rounded-full px-3 py-1 text-[13px] font-semibold text-ink">{value}</span>}
    <ChevronRight className="h-4 w-4 text-mute" strokeWidth={2} />
  </div>
);

export const ProfileScreen = () => (
  <div className="vo-neu-page relative h-full w-full overflow-hidden">
    <StatusBar />
    <Header icons={[Bell, Settings]} />
    <div className="mt-4 flex items-center gap-4 px-5">
      <span className="relative">
        <LogoMark size={82} />
        <span className="vo-soft-icon absolute -bottom-1 -right-1 h-[30px] w-[30px]">
          <Camera className="h-[15px] w-[15px]" strokeWidth={2} />
        </span>
      </span>
      <span className="flex flex-col items-start">
        <span className="text-[26px] font-bold tracking-[-0.02em] text-ink">Arin dimkj</span>
        <span className="vo-soft mt-2 rounded-full px-4 py-1.5 text-[14px] font-semibold text-ink">Edit profile</span>
      </span>
    </div>
    <div className="mt-4 flex justify-end gap-6 px-6 text-center">
      {["Followers", "Following", "Profile views"].map((l) => (
        <span key={l} className="flex flex-col">
          <span className="text-[18px] font-bold text-ink">0</span>
          <span className="text-[12px] text-mute">{l}</span>
        </span>
      ))}
    </div>
    <div className="vo-soft mx-5 mt-4 rounded-[22px] px-4 py-3.5">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-mute">Profile completion</span>
      <span className="mt-1 flex items-center justify-between">
        <span className="text-[18px] font-bold tracking-[-0.02em] text-ink">You're almost there</span>
        <span className="vo-soft flex items-center gap-1 rounded-full px-3 py-1 text-[14px] font-bold text-ink">
          56% <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </span>
      <span className="mt-1 block text-[12.5px] text-mute">Add a few more details to get better matches on VOILADI.</span>
      <span className="mt-3 block h-[6px] rounded-full bg-black/5">
        <span className="block h-full w-[56%] rounded-full bg-ink" />
      </span>
    </div>
    <div className="vo-soft mx-5 mt-3 overflow-hidden rounded-[22px]">
      <Row Icon={Zap} title="Boost" sub="Be seen by more people" value="01:23:48" />
      <Row Icon={Star} title="Super Likes" sub="Show someone you're really interested" value="5" />
      <Row Icon={Crown} title="VOILADI+" sub="Unlock premium features" last />
    </div>
    <div className="vo-soft mx-5 mt-3 overflow-hidden rounded-[22px]">
      <Row Icon={User} title="Account" />
      <Row Icon={Lock} title="Privacy & Safety" />
      <Row Icon={SlidersHorizontal} title="Preferences" />
      <Row Icon={CircleHelp} title="Help & Support" last />
    </div>
    <Nav active="Profile" />
  </div>
);

export const SCREENS = [
  { key: "explore", Screen: ExploreScreen, title: "Explore your world", sub: "Discover people, interests, and communities." },
  { key: "chat", Screen: MessagesScreen, title: "Chat your way", sub: "Text, photos, or video - however you feel like it." },
  { key: "likes", Screen: LikesScreen, title: "See who notices you", sub: "Likes and interest, all in one glance." },
  { key: "profile", Screen: ProfileScreen, title: "Own your profile", sub: "Customize your identity, settings, and presence." },
];

/* Phone frame: soft white body with a thin bezel; the 390x820 screen is scaled to fit inside and clipped. */
export const Phone = ({ Screen, width }) => {
  const bezel = Math.max(6, Math.round(width * 0.03));
  const innerW = width - bezel * 2;
  const scale = innerW / 390;
  const innerH = Math.round(820 * scale);
  const outerR = Math.round(width * 0.16);
  return (
    <div className="vo-phone" style={{ width, height: innerH + bezel * 2, padding: bezel, borderRadius: outerR }}>
      <div className="vo-phone-clip" style={{ width: innerW, height: innerH, borderRadius: Math.max(8, outerR - bezel) }}>
        <div className="vo-phone-screen" style={{ width: 390, height: 820, transform: `scale(${scale})` }}>
          <Screen />
        </div>
      </div>
    </div>
  );
};
