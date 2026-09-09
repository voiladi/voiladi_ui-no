# Voiladi — UI Specification (derived 1:1 from the user's interface photos)

These rules are transcribed from the two reference boards the user supplied (10 onboarding screens + 8 main-app screens).
They are NOT a creative direction. Any element not visible in the photos must be styled with the same primitives below.
Do not introduce new colours, fonts, textures, serif type, gradients (except the photo overlay on Splash/Discover card) or decorative rules.

## 1. Canvas & shell
- Phone-first: content column max 430px, centred on desktop on a #F2F2F7 backdrop; on mobile it is full-bleed.
- Page background: pure white `#FFFFFF`. Dark mode: `#000000` page, `#1C1C1E` surfaces (Settings screen shows a Dark Mode toggle).
- Status-bar area / safe areas respected (env(safe-area-inset-*)).
- Horizontal page padding: 16px on app tabs (Discover/Explore/Likes/Chat/Profile, Settings, Edit Profile); 20px on onboarding/auth screens.

## 2. Colour tokens
| Token | Light | Dark | Used for |
|---|---|---|---|
| --bg | #FFFFFF | #000000 | page |
| --surface | #F2F2F4 | #1C1C1E | inputs, chips (off), list cards, search bar, segmented track |
| --surface-2 | #E9E9EC | #2C2C2E | pressed state, skeleton |
| --ink | #111111 | #F5F5F7 | primary text, primary buttons, active icons |
| --ink-2 | #3A3A3C | #D1D1D6 | secondary headings |
| --muted | #8A8A8E | #8E8E93 | secondary text, inactive tab icons/labels, placeholders |
| --line | #E5E5EA | #2C2C2E | hairlines between rows, outline buttons |
| --blue | #3478F6 | #4C8DFF | verified badge, Voila star |
| --red | #FF3B30 | #FF453A | Log Out text, like badge on avatars, red dot on "Liked you" |
| --on-ink | #FFFFFF | #000000 | text on primary buttons |

## 3. Typography
- Family: **Inter** (closest web match to the SF Pro used in the photos), weights 400/500/600/700. No serif, no mono.
- Scale (px / weight / letter-spacing):
  - Page title ("Explore", "Likes", "Chat"): 30 / 700 / -0.02em
  - Onboarding headline ("Create your account", "Enter the code"): 28 / 700 / -0.02em; subtitle 16 / 400 muted
  - Splash headline ("Good people. Better connections."): 28 / 700, white, centred; splash logo 88 + wordmark 46; welcome logo 80 + wordmark 40
  - Card name ("Aanya"): 32 / 700, white; age 26 / 500; job + distance lines 16 / 500
  - Row title (name in Likes/Chat lists): 18 / 600; row subtitle 15 / 400 muted; avatars 64 (Likes) / 60 (Chat)
  - Profile: name 28 / 700; tagline 14 muted + chevron; stats 19 / 700 with 13 muted labels; completion title 23 / 700; feature row title 17 / 700 + 12.5 muted sub; menu row 17 / 600
  - Section label ("About me", "Basics", "Show me", Filters headings): 17 / 600
  - Input label: 15 / 600
  - Tab label: 12 / 500 (active 600); tab icons 26px
  - Button: 16 / 600
  - Chip: 15 / 500
- Wordmark: "voiladi" lowercase, 20 / 700, letter-spacing -0.01em, sits right of the logo tile.

## 4. Logo
- Tile: black (#111) rounded square (radius 23.5%) with a two-stroke "V" (viewBox 100): white stroke 15.5 wide from (29.5,30) to (48,72) in front; light-grey #C8CACE stroke 12.5 wide from (71,30) to (55,64) behind. Same geometry in /public/favicon.svg and the PNG app icons. Wordmark: Inter 800, letter-spacing -0.035em. 30px in headers, 76px on Welcome, 84px on the boot splash, 88px on All set.
- Header pattern: [tile 30px] 8px [wordmark 21px] on the left of Discover / Explore / Likes / Chat / Profile; header height 56, icon buttons 40px circles on the right.

## 5. Radii
- Pill buttons & chips: 9999px
- Inputs, search bar: 14px (height 52; search bar 48)
- List cards / grouped lists: 16px
- Stat/list rows inside cards: none (dividers only)
- Discover card & Explore tiles: 24px
- Avatars: circle
- Bottom sheet / modal: 20px top corners

## 6. Components (exactly as photographed)
### Buttons
- Primary: height 48, full width, bg --ink, text --on-ink, pill.
- Secondary (outline): height 48, bg --bg, 1px --line border, text --ink, pill ("Log in", "Skip for now", "Not now", "Edit Profile" small variant height 36).
- On photo (Splash): white pill "Create account" (text ink) + translucent dark pill "Log in" (rgba(0,0,0,.35) + white text + 1px white/30 border).
- Text link: 14 / 500 --blue ("Log in" in "Already have an account?").
- Icon button: 40px circle, bg --surface, 20px icon (filters icon, search, bell, gear). Chat compose is a bare 24px SquarePen icon.
- Discover actions: three white circles with soft shadow (0 6px 18px rgba(0,0,0,.10)): X 64px (ink icon 28), Heart 76px (ink filled heart 32), Star 64px (blue filled star 28).

### Inputs
- Height 52, bg --surface, radius 14, padding 0 16, text 16, placeholder --muted, no border; focus: 1.5px --ink ring.
- Label above: 15 / 600 --ink, 8px gap.
- Phone input: leading flag emoji + "+91" + chevron (transparent native <select> on top), vertical divider, then number.
- OTP: six 48x56 boxes, bg --bg (white) with 1px --line border, radius 12, digit 24 / 500; active box border --ink.
- Date of birth: input with trailing calendar icon.
- Password: trailing eye icon.

### Chips (interests, explore filters)
- Height 42 (onboarding grid 44), padding 0 20, pill. Off: bg --surface, text --ink. On: bg --ink, text --on-ink.
- Interests are laid out in a 3-column grid (onboarding) or wrapped (filters, card overlay).
- Card overlay chips (Discover): DARK translucent rgba(0,0,0,.38) + backdrop-blur 8px, white text 14 / 500, height 32.

### Segmented control (Likes tabs, Filters "Show me")
- Track: bg --surface, pill, padding 4; items 36 tall, text 15. Active segment: bg --bg (white) pill with shadow 0 1px 3px rgba(0,0,0,.08), text --ink 600; inactive text --muted.
  Same white style everywhere (Likes tabs, Filters "Show me", gender).

### Sliders (Filters)
- Track 4px --surface-2, range --ink, thumb 24px white circle with shadow 0 1px 4px rgba(0,0,0,.2). Value label right-aligned 14 / 600.

### Lists
- Grouped list card (Settings): bg --surface, radius 16, rows height 56, 16px horizontal padding, 1px --line divider (inset 16px), leading icon 22px --ink, title 16 / 500, trailing chevron-right 18px --muted or value text 14 --muted.
- Likes rows: 64px avatar with 24px red heart badge, name 18 / 600 + age 18 / 400, subtitle 15 muted with red dot, chevron 20 + "…" 24 muted; 1px --line divider.
- Chat rows: 60px avatar, name 18 / 600, preview 15 muted, time 14 muted, unread badge 24px circle bg --ink white 13 / 600.
- Profile feature rows (Boost / Super Likes / VOILADI+): inside ONE grey card (bg --surface, radius 20), rows 64 tall, 14px side padding, 40px WHITE rounded-12 icon tile with filled ink icon, title 17 / 700, sub 12.5 muted, WHITE value pill (h 28), chevron 14 muted; hairline between rows starting at x=64.
- Profile account menu (Account / Privacy & Safety / Preferences / Help & Support): same grey card, rows 46 tall, 22px outlined icons in the 40px column, title 17 / 600, chevron 18.

### Cards
- Discover card: fills width (16px margins), radius 24, photo cover, bottom gradient rgba(0,0,0,0)→rgba(0,0,0,.65) on lower 55%, "…" 40px dark translucent circle top-right, NO photo progress strip, name 32/age 26/verified badge row, briefcase+job line, pin+distance line (16 / 500 white), dark glass interest chips row.
- Explore tile: 2 columns, gap 12, aspect 3:4, radius 20, gradient bottom, name+age 16 / 600 white, "• 2 km" 12 white/80 with orange (#F59E0B) or grey dot, "…" top-right.
- Profile header block: 100px round avatar with a 30px WHITE camera disc (shadow) at bottom-right; right column: name 28 / 700, tagline 14 muted + chevron (opens Edit Profile), stats row (Followers | Following | Profile views) with 40px hairline dividers. No separate "Edit Profile" button.
- Profile completion card: bg --surface, radius 20, padding 16, "PROFILE COMPLETION" 12 / 600 uppercase tracking .06em muted, title 23 / 700 "You're almost there", % 23 / 700 + 28px --surface-2 circle with chevron, subtitle 15 muted ("Add a few more details to get better matches on VOILADI."), 8px progress bar --ink on --surface-2.
- Boost is REAL: 90-minute boost, one per 24h; pill shows live HH:MM:SS countdown while running, "Start" when available, "Tomorrow" when on cooldown.

### Bottom tab bar
- Height 62 + safe-area, bg --bg, 1px --line top border. 5 tabs: Discover (two overlapping squares = lucide Copy), Explore (search), Likes (heart), Chat (message-circle), Profile (user). Icons 26px, labels 12.
- Active: icon filled --ink, label 600 --ink. Inactive: 1.7 stroke --muted. New activity = plain 9px red dot on the icon (no number).

### Headers
- App tabs: 56px, logo left, 36px circle icon button(s) right.
- Modal pages (Edit Profile, Filters): "Cancel" left 16 / 400, title centred 16 / 600, "Done"/"Reset" right 16 / 600.
- Settings: "< Back" left, title centred.
- Onboarding: back arrow 24px at top-left, then headline + 15 / 400 muted subtitle, 32px gap to fields, primary button pinned at bottom (24px from safe area) with optional secondary below or a small muted note.

### Feedback
- Toasts (Sonner): bg --ink, text white, radius 14, 14 / 500, no icons colour-coded (success/error only differ in text).
- Match dialog: white sheet radius 24, two 96px round photos overlapping, "It's a match!" 26 / 700, subtitle muted, primary "Send a message", text button "Keep swiping".
- Skeletons: --surface blocks with the same radii as the element they replace.
- Empty states: centred, 56px --surface circle with 24px ink icon, title 17 / 600, subtitle 14 muted, optional primary button.

## 7. Motion
- 150–220ms ease-out on opacity/transform only. Card swipe uses drag with rotation ≤ 8deg. No bounces.

## 8. Icons
- lucide-react only, 1.75 stroke; filled variants for active tab icons and the heart/star action buttons.

## 9. Accessibility & test hooks
- Every interactive/critical element has a unique kebab-case `data-testid`.
- Colour contrast: ink on white, white on ink, muted only for secondary text.

## 10. Welcome screen (final, from the user's high-res reference)
- Single white screen, no photo, no pager. Content centred: logo 76 -> wordmark 34 / 700 -> (56px gap) headline "Connect / with people." 40 / 700 / -0.03em, 2 lines -> blurb 17 muted, max-width 300, 3 lines ("Share your moments, discover new perspectives, and be part of a global community.").
- Bottom block (24px side padding): "Create new account" ink pill h 50 / 17 600; 16px gap; "Log in" pill bg --surface with 1px --line border, ink text; 32px gap; legal line 13 muted, 2 lines, links underlined --ink-2.

## 11. Loading & motion system (professional feel)
- `components/Loading.jsx`: `Spinner` (thin ring with a gap, 0.85s linear spin, inherits colour), `PageLoader` (centred 30px spinner), `BlockingLoader`, `Skeleton`, `SkeletonRow` (avatar + 2 bars + trailing block), `SkeletonList`, `SkeletonLines`.
- Boot splash = logo 84 centred + 22px spinner near the bottom.
- Lists (Likes, Chat) load with `SkeletonList`; Explore with 6 tile skeletons; Discover with a card skeleton; chat room with a centred spinner; Profile stats/pills with tiny skeleton bars.
- Any button doing work: `aria-busy` + `<Spinner size={20} />` replaces the label; the button stays solid ink (never greyed out) and ignores taps.
- Photos: shimmer behind, fade in 260ms once decoded (`UserPhoto`).
- Route changes: tabs cross-fade 150ms; pushed screens slide in 28px from the right (AppShell AnimatePresence).

## 12. Fit-to-device scaling (hooks/useFitScale.js)
- Screens are authored on a 393 x 852 canvas. On viewports smaller than that (Safari toolbars, small Androids) the shell is laid out
  at (viewport / scale) and scaled with `transform: scale()` (scale = clamp(0.78, min(vw/393, vh/852), 1)). Desktop keeps the 430px frame.
  The scale is frozen while an input is focused (on-screen keyboard) and re-applied on blur. Do not use vh units inside screens.

## 13. Profile screen (final hi-res reference) — canvas bg --canvas #F6F6F8, white cards
- Header 52: Brand 34 left; two 38px --surface-2 circles right (bell with red dot, gear), page padding 12.
- Avatar 102 + 32px white camera disc bottom-right; name 26/700, tagline 14 muted + chevron, stats 20/700 + 14 muted with 32px hairlines.
- Cards `.vo-pcard` (white, radius 16, faint edge) with 10px side margins: completion (label 11/600 upper .08em, title 22/700, % 22/700 + 24px chevron circle,
  sub 14 muted, bar 6px) -> features (rows 60, 38px --surface-2 icon tile radius 10 with filled 20px icon, title 18/700, sub 12.5 muted, --surface-2 value pill h26 14/600,
  chevron 16; hairline inset 68px left / 10px right) -> menu (rows 42, outlined 24px icons, label 17/500).
- Everything fits 393 x 852 without scrolling; bottom padding 74 for the tab bar (62 + 13px labels + 27px icons).
