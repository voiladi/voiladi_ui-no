# Voiladi — UI Specification (derived 1:1 from the user's interface photos)

These rules are transcribed from the two reference boards the user supplied (10 onboarding screens + 8 main-app screens).
They are NOT a creative direction. Any element not visible in the photos must be styled with the same primitives below.
Do not introduce new colours, fonts, textures, serif type, gradients (except the photo overlay on Splash/Discover card) or decorative rules.

## 1. Canvas & shell
- Phone-first: content column max 430px, centred on desktop on a #F2F2F7 backdrop; on mobile it is full-bleed.
- Page background: pure white `#FFFFFF`. Dark mode: `#000000` page, `#1C1C1E` surfaces (Settings screen shows a Dark Mode toggle).
- Status-bar area / safe areas respected (env(safe-area-inset-*)).
- Horizontal page padding: 20px.

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
  - Page title ("Explore", "Likes", "Chat"): 28 / 700 / -0.02em
  - Onboarding headline ("Create your account", "Enter the code"): 26 / 700 / -0.02em
  - Splash headline ("Good people. Better connections."): 24 / 700, white, centred
  - Card name ("Aanya"): 30 / 700, white; age 26 / 500
  - Row title (name in lists): 16 / 600
  - Body / row subtitle: 14 / 400, muted
  - Section label ("About me", "Basics", "Show me"): 15 / 600
  - Tab label: 11 / 500 (active 600)
  - Button: 15 / 600
  - Chip: 14 / 500
- Wordmark: "voiladi" lowercase, 20 / 700, letter-spacing -0.01em, sits right of the logo tile.

## 4. Logo
- Tile: black (#111) rounded square (radius 22% of size) with a white bold "V" (custom SVG), 28px in headers, 72px on Splash/Welcome/All set.
- Header pattern: [tile 28px] 8px [wordmark] on the left of Discover / Explore / Likes / Chat / Profile.

## 5. Radii
- Pill buttons & chips: 9999px
- Inputs, search bar: 12px
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
- Icon button: 36px circle, bg --surface (filters icon, search, compose, bell, gear).
- Discover actions: three white circles with soft shadow (0 6px 18px rgba(0,0,0,.10)): X 56px (ink icon), Heart 64px (ink filled heart), Star 56px (blue filled star).

### Inputs
- Height 48, bg --surface, radius 12, padding 0 16, text 16, placeholder --muted, no border; focus: 1.5px --ink ring.
- Label above: 14 / 500 --ink, 8px gap.
- Phone input: leading flag emoji + "+91" + chevron, vertical divider, then number.
- OTP: six 44x52 boxes, bg --surface, radius 10, digit 20 / 600.
- Date of birth: input with trailing calendar icon.
- Password: trailing eye icon.

### Chips (interests, explore filters)
- Height 36 (onboarding grid 40), padding 0 16, pill. Off: bg --surface, text --ink. On: bg --ink, text --on-ink.
- Interests are laid out in a 3-column grid (onboarding, filters) or wrapped (card overlay).
- Card overlay chips: rgba(255,255,255,.18) + backdrop-blur 8px, white text, height 30.

### Segmented control (Likes tabs, Filters "Show me")
- Track: bg --surface, pill, padding 3. Active segment: bg --bg (light) pill with shadow 0 1px 3px rgba(0,0,0,.08), text --ink 600; inactive text --muted.
  (Filters "Show me" active segment is bg --ink with white text.)

### Sliders (Filters)
- Track 4px --surface-2, range --ink, thumb 24px white circle with shadow 0 1px 4px rgba(0,0,0,.2). Value label right-aligned 14 / 600.

### Lists
- Grouped list card: bg --surface, radius 16, rows height 52, 16px horizontal padding, 1px --line divider (inset 16px), leading icon 20px --ink, title 15 / 500, trailing chevron-right 16px --muted or value text 14 --muted.
- Likes / Chat rows: white background, 48px round avatar, name 16 / 600 + age 16 / 400, subtitle 14 muted, right side time/chevron/"…" muted; 1px --line divider under each row.
- Unread badge: 22px circle bg --ink, white 12 / 600.

### Cards
- Discover card: fills width (20px margins), aspect ≈ 3:4.2, radius 24, photo cover, bottom gradient rgba(0,0,0,0)→rgba(0,0,0,.65) on lower 45%, "…" 32px translucent circle top-right, name/age/verified row, briefcase+job line, pin+distance line (14 / 400 white), interest chips row.
- Explore tile: 2 columns, gap 12, aspect 3:4, radius 20, gradient bottom, name+age 16 / 600 white, "• 2 km" 12 white/80 with orange (#F59E0B) or grey dot, "…" top-right.
- Profile completion card: bg --surface, radius 16, title 16 / 600 "You're almost there", % 15 / 600 + chevron, subtitle 13 muted, 6px progress bar --ink on --surface-2.
- Profile feature rows (Boost / Super Likes / VOILADI+): white card 1px --line radius 16, 40px round icon holder --surface with ink icon, title 15 / 600, subtitle 13 muted, trailing pill --surface with value, chevron.

### Bottom tab bar
- Height 56 + safe-area, bg --bg, 1px --line top border. 5 tabs: Discover (layers/cards icon), Explore (search), Likes (heart), Chat (message-circle), Profile (user).
- Active: icon filled --ink, label 600 --ink. Inactive: 1.75 stroke --muted.

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
