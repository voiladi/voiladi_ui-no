> REVISION 3 (FINAL, user-confirmed): the v2 hot-pink/iOS-blue system was ALSO rejected ("AI vibe": neon accents, big radii,
> bouncy springs, confetti, rich toasts). CURRENT BINDING SYSTEM = "Apple/iOS monochrome + one deep muted accent":
> - Palette: ink #1D1D1F (labels, PRIMARY BUTTONS, ACTIVE HEARTS), ink2 #3A3A3C, mute #6E6E73, mute2 #8E8E93, paper #FFFFFF,
>   surface2 #F5F5F7 (fills), surface3 #E8E8ED (pressed), line #E5E5EA, tint (accent) #2B4C7E deep navy (links, progress,
>   selected radios, slider, compat ring, sent chat bubbles, Voila bolt, active tab), tint-dark #1F3A63, tint-soft #EDF1F7,
>   danger #D70015 (destructive TEXT only), online #34C759 (tiny presence dot only). NO pink/orange/yellow/gradients anywhere.
> - Type: system stack -apple-system, BlinkMacSystemFont, "SF Pro Text/Display", Inter fallback. h1 28px/700/-0.02em, h2 20px/600, body 15-17px.
> - Radii: 12px buttons+inputs (rounded-btn), 16px cards (rounded-card), 20px sheets/modals/swipe card (rounded-sheet), 40px desktop phone frame.
> - Motion: tween ease [0.25,0.1,0.25,1] 150-300ms; opacity/transform only; drag return spring stiff+damped (no overshoot). NO confetti, NO pop-in springs, NO layoutId pill.
> - Toasts: iOS banner (white/blur, 14px, top-center), no richColors, only meaningful toasts (errors, saved, blocked, report received).
> - Bottom nav: flat iOS tab bar (hairline top, icon+label, navy active). Landing: monochrome line-art SVG illustration.
> - Tailwind tokens: ink, ink2, paper, surface2, surface3, line, mute, mute2, tint, tint-dark, tint-soft, danger, online; rounded-btn/card/sheet/frame; shadow-soft/card/float.


> REVISION (user feedback after v1 preview): The teal/"ocean" palette and Space Grotesk/Figtree fonts were REJECTED by the user
> ("feels AI"). CURRENT SYSTEM: iPhone-native look.
> - Fonts: system stack `-apple-system, BlinkMacSystemFont, "SF Pro Display/Text", Inter (fallback), Helvetica Neue` — bold/extrabold headings, tight tracking (-0.03em).
> - Colors: ink #0A0A0F (primary buttons are BLACK), brand hot pink #FF2D75 (accent, likes, badges, progress, selected chips),
>   iOS blue #0A84FF (Voila/superlike), iOS green #22A447 (online/like-state only), iOS red #FF3B30 (pass/destructive), amber #FFB020, yellow #FFD60A.
>   Neutrals: paper #FAFAFC, surface-2 #F2F2F7, border #E5E5EA, muted #6E6E76.
> - Tailwind tokens: brand, brand-dark, brand-soft, voila(-soft), like(-soft), pass(-soft), peach(-soft), lime(-soft), ink, ink2, paper, surface2, line, mute.
> - NEVER reintroduce teal/green as a brand color. Avoid anything that reads "AI" (sparkles icons, gradients-on-text, etc.).

{
  "brand": {
    "name": "Voiladi",
    "positioning": "Apple/Google-grade clean + Gen-Z tactile playfulness. Photo-first, prompt-forward, zero gimmicks. Feels like a premium camera app + magazine layout, not a ‘dating template’.",
    "visual_personality": [
      "clean",
      "tactile",
      "editorial",
      "confident",
      "warm",
      "playful-but-not-childish"
    ],
    "logo_wordmark_idea_css_svg_only": {
      "wordmark": "Lowercase ‘voiladi’ with a custom ligature: connect ‘oi’ with a subtle bridge stroke. Keep letterforms wide and calm (no condensed).",
      "mark": "A ‘V’ formed by two rounded strokes that almost meet (a ‘near-connection’ motif). Use as an app icon on a solid background (no gradients).",
      "implementation_hint": "Create an inline SVG for the mark (stroke-linecap=round, stroke-width=10, viewBox 0 0 64 64). Pair with text in a flex row."
    }
  },
  "design_tokens": {
    "notes": [
      "Light mode default. No transparent page backgrounds.",
      "Avoid Tinder red/orange clichés. Use a fresh ocean-mint + ink + soft peach accent.",
      "All colors below are provided as HEX plus suggested HSL tokens for shadcn variables. Main agent should map these into src/index.css :root tokens."
    ],
    "color_system": {
      "palette_hex": {
        "ink": "#0B1220",
        "ink_2": "#111A2E",
        "paper": "#FBFBFC",
        "surface": "#FFFFFF",
        "surface_2": "#F4F6FA",
        "border": "#E6E9F2",
        "muted_text": "#5B6476",
        "primary_ocean": "#0EA5A4",
        "primary_ocean_dark": "#0B7F7E",
        "accent_peach": "#FFB38A",
        "accent_lime": "#B9F27C",
        "like": "#16A34A",
        "pass": "#E11D48",
        "voila_super": "#2563EB",
        "warning": "#F59E0B"
      },
      "shadcn_css_variables_hsl": {
        "background": "220 20% 99%",
        "foreground": "222 47% 8%",
        "card": "0 0% 100%",
        "card-foreground": "222 47% 8%",
        "popover": "0 0% 100%",
        "popover-foreground": "222 47% 8%",
        "primary": "181 84% 35%",
        "primary-foreground": "0 0% 100%",
        "secondary": "220 25% 96%",
        "secondary-foreground": "222 47% 10%",
        "muted": "220 25% 96%",
        "muted-foreground": "222 12% 42%",
        "accent": "220 25% 96%",
        "accent-foreground": "222 47% 10%",
        "destructive": "347 77% 50%",
        "destructive-foreground": "0 0% 100%",
        "border": "225 25% 91%",
        "input": "225 25% 91%",
        "ring": "181 84% 35%",
        "radius": "1rem"
      },
      "semantic_tokens": {
        "text_primary": "var(--vo-ink)",
        "text_secondary": "var(--vo-muted)",
        "bg_app": "var(--vo-paper)",
        "bg_surface": "var(--vo-surface)",
        "bg_surface_2": "var(--vo-surface-2)",
        "stroke": "var(--vo-border)",
        "focus_ring": "hsl(var(--ring))",
        "state_like": "var(--vo-like)",
        "state_pass": "var(--vo-pass)",
        "state_voila": "var(--vo-voila)"
      },
      "additional_css_custom_properties_to_add": {
        "--vo-ink": "#0B1220",
        "--vo-muted": "#5B6476",
        "--vo-paper": "#FBFBFC",
        "--vo-surface": "#FFFFFF",
        "--vo-surface-2": "#F4F6FA",
        "--vo-border": "#E6E9F2",
        "--vo-ocean": "#0EA5A4",
        "--vo-ocean-dark": "#0B7F7E",
        "--vo-peach": "#FFB38A",
        "--vo-lime": "#B9F27C",
        "--vo-like": "#16A34A",
        "--vo-pass": "#E11D48",
        "--vo-voila": "#2563EB",
        "--vo-shadow": "0 18px 50px rgba(11,18,32,0.10)",
        "--vo-shadow-soft": "0 10px 30px rgba(11,18,32,0.08)",
        "--vo-noise-opacity": "0.06"
      }
    },
    "gradients_and_texture": {
      "gradient_restriction_rule": {
        "prohibited": [
          "blue-500 to purple-600",
          "purple-500 to pink-500",
          "green-500 to blue-500",
          "red to pink",
          "any dark/saturated gradient combo"
        ],
        "limits": [
          "Gradients must not cover >20% of viewport",
          "No gradients on text-heavy reading areas",
          "No gradients on small UI elements (<100px width)",
          "Never stack multiple gradient layers in the same viewport"
        ],
        "allowed_usage": [
          "Hero/splash background only (subtle)",
          "Decorative corner glows behind phone shell on desktop",
          "Very large, low-contrast section wash"
        ]
      },
      "approved_gradients": {
        "ambient_desktop_backdrop": "radial-gradient(900px circle at 20% 10%, rgba(14,165,164,0.14), transparent 55%), radial-gradient(700px circle at 85% 25%, rgba(255,179,138,0.16), transparent 60%)",
        "welcome_header_wash": "linear-gradient(135deg, rgba(14,165,164,0.14), rgba(255,179,138,0.12))"
      },
      "noise_overlay_css": "background-image: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"120\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"3\" stitchTiles=\"stitch\"/></filter><rect width=\"120\" height=\"120\" filter=\"url(%23n)\" opacity=\"0.35\"/></svg>'); mix-blend-mode: multiply; opacity: var(--vo-noise-opacity); pointer-events:none;"
    },
    "typography": {
      "google_fonts": {
        "display": {
          "family": "Space Grotesk",
          "weights": ["500", "600", "700"],
          "usage": "Brand wordmark, page titles, card names"
        },
        "body": {
          "family": "Figtree",
          "weights": ["400", "500", "600"],
          "usage": "Body, labels, chips, chat"
        }
      },
      "font_loading_instruction": "Add <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"/> and <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin/> then load Space Grotesk + Figtree in public/index.html.",
      "tailwind_font_family_extension": {
        "font-display": "['Space Grotesk', 'ui-sans-serif', 'system-ui']",
        "font-sans": "['Figtree', 'ui-sans-serif', 'system-ui']"
      },
      "type_scale": {
        "h1": "text-4xl sm:text-5xl lg:text-6xl font-display font-semibold tracking-tight",
        "h2": "text-base md:text-lg font-sans text-muted-foreground",
        "card_name": "text-2xl font-display font-semibold tracking-tight",
        "body": "text-sm sm:text-base font-sans",
        "caption": "text-xs font-sans text-muted-foreground"
      }
    },
    "spacing_radius_shadow": {
      "spacing": {
        "screen_padding": "px-4",
        "section_gap": "gap-6",
        "card_padding": "p-4",
        "chip_gap": "gap-2"
      },
      "radii": {
        "app_shell": "rounded-[28px]",
        "card": "rounded-[24px]",
        "sheet": "rounded-t-[24px]",
        "button": "rounded-[14px]",
        "chip": "rounded-full"
      },
      "shadows": {
        "card": "shadow-[0_18px_50px_rgba(11,18,32,0.10)]",
        "floating_nav": "shadow-[0_10px_30px_rgba(11,18,32,0.10)]",
        "pressed": "shadow-[0_6px_18px_rgba(11,18,32,0.10)]"
      }
    },
    "motion": {
      "library": "framer-motion",
      "principles": [
        "Tactile: small scale on press (0.98) and quick return",
        "Springy swipe physics, but never bouncy like a toy",
        "Use opacity+translate for entrances; avoid spinning"
      ],
      "recommended_springs": {
        "ui": {"type": "spring", "stiffness": 520, "damping": 38, "mass": 0.9},
        "card_swipe": {"type": "spring", "stiffness": 420, "damping": 32, "mass": 1.0},
        "modal_pop": {"type": "spring", "stiffness": 360, "damping": 26, "mass": 0.9}
      },
      "durations": {
        "fast": 0.14,
        "base": 0.22,
        "slow": 0.36
      },
      "swipe_thresholds": {
        "like_x": 120,
        "pass_x": -120,
        "voila_y": -110
      }
    },
    "accessibility": {
      "requirements": [
        "WCAG AA contrast for text",
        "44px minimum tap targets",
        "Provide button alternatives for swipe actions",
        "Respect prefers-reduced-motion (reduce swipe flourish, keep essential transitions)"
      ],
      "focus_styles": "Use focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    }
  },
  "layout_and_grid": {
    "mobile_first": {
      "primary_viewport": "390x844",
      "safe_areas": "Add pb-[calc(16px+env(safe-area-inset-bottom))] for bottom nav areas on iOS."
    },
    "desktop_presentation": {
      "approach": "Centered phone-shell is allowed on desktop. Surround with a solid paper background + subtle ambient gradient glows behind the shell (<=20% viewport).",
      "phone_shell_recipe": "mx-auto my-10 w-full max-w-[420px] rounded-[32px] border border-[color:var(--vo-border)] bg-[color:var(--vo-paper)] shadow-[0_30px_90px_rgba(11,18,32,0.14)] overflow-hidden"
    },
    "screen_structure": {
      "app_shell": "Top status area (optional), main content scroll, bottom nav fixed.",
      "discover": "Card stack centered with action dock below.",
      "likes": "2-column grid on mobile, 3-4 on desktop shell.",
      "chats": "List with sticky search (optional) and segmented tabs (Matches/Chats) if needed."
    }
  },
  "components": {
    "component_path": {
      "shadcn": {
        "Button": "/app/frontend/src/components/ui/button.jsx",
        "Drawer": "/app/frontend/src/components/ui/drawer.jsx",
        "Dialog": "/app/frontend/src/components/ui/dialog.jsx",
        "Sheet": "/app/frontend/src/components/ui/sheet.jsx",
        "Input": "/app/frontend/src/components/ui/input.jsx",
        "InputOTP": "/app/frontend/src/components/ui/input-otp.jsx",
        "Slider": "/app/frontend/src/components/ui/slider.jsx",
        "Tabs": "/app/frontend/src/components/ui/tabs.jsx",
        "Avatar": "/app/frontend/src/components/ui/avatar.jsx",
        "Badge": "/app/frontend/src/components/ui/badge.jsx",
        "Card": "/app/frontend/src/components/ui/card.jsx",
        "Progress": "/app/frontend/src/components/ui/progress.jsx",
        "Skeleton": "/app/frontend/src/components/ui/skeleton.jsx",
        "Textarea": "/app/frontend/src/components/ui/textarea.jsx",
        "Tooltip": "/app/frontend/src/components/ui/tooltip.jsx",
        "Calendar": "/app/frontend/src/components/ui/calendar.jsx",
        "Sonner": "/app/frontend/src/components/ui/sonner.jsx"
      }
    },
    "recipes": {
      "AppShell": {
        "description": "Wraps the whole app. On desktop shows phone shell; on mobile full-bleed.",
        "class_recipe": {
          "desktop_backdrop": "min-h-dvh bg-[color:var(--vo-paper)] relative",
          "desktop_glow_layer": "pointer-events-none absolute inset-0 [background:var(--vo-ambient,radial-gradient(900px_circle_at_20%_10%,rgba(14,165,164,0.14),transparent_55%),radial-gradient(700px_circle_at_85%_25%,rgba(255,179,138,0.16),transparent_60%))]",
          "shell": "relative mx-auto w-full max-w-[420px] min-h-dvh lg:my-10 lg:min-h-[860px] lg:rounded-[32px] lg:border lg:border-[color:var(--vo-border)] lg:bg-[color:var(--vo-paper)] lg:shadow-[0_30px_90px_rgba(11,18,32,0.14)] overflow-hidden"
        },
        "data_testids": {
          "root": "app-shell"
        }
      },
      "BottomNav": {
        "description": "Floating pill bar with animated active indicator (dot + underline).",
        "layout": "Fixed bottom inside shell. 4 tabs: Discover, Likes, Chats, Profile.",
        "class_recipe": {
          "bar": "fixed bottom-3 left-1/2 -translate-x-1/2 w-[min(92vw,392px)] rounded-full border border-[color:var(--vo-border)] bg-white/92 backdrop-blur-md shadow-[0_10px_30px_rgba(11,18,32,0.10)] px-2 py-2",
          "tab": "flex-1 h-11 rounded-full flex items-center justify-center gap-2 text-sm font-medium text-[color:var(--vo-muted)]",
          "tab_active": "text-[color:var(--vo-ink)]",
          "indicator": "absolute top-1/2 -translate-y-1/2 h-11 rounded-full bg-[color:var(--vo-surface-2)]"
        },
        "motion": "Use framer-motion layoutId='bottom-nav-indicator' for the active pill.",
        "data_testids": {
          "nav": "bottom-nav",
          "discover": "bottom-nav-discover",
          "likes": "bottom-nav-likes",
          "chats": "bottom-nav-chats",
          "profile": "bottom-nav-profile"
        }
      },
      "WelcomeSplash": {
        "description": "Brand-first splash with subtle gradient wash + noise. CTA to Get started.",
        "class_recipe": {
          "screen": "min-h-dvh bg-[color:var(--vo-paper)]",
          "header_wash": "rounded-[28px] p-6 [background:linear-gradient(135deg,rgba(14,165,164,0.14),rgba(255,179,138,0.12))]",
          "cta": "w-full h-12 rounded-[14px]"
        },
        "data_testids": {
          "get_started": "welcome-get-started-button"
        }
      },
      "PhoneAuth": {
        "description": "Phone number + OTP flow. Use Input + InputOTP shadcn.",
        "otp_ui": "6 digits, slots 44px tap target, active ring uses --ring.",
        "data_testids": {
          "phone_input": "auth-phone-input",
          "send_otp": "auth-send-otp-button",
          "otp_input": "auth-otp-input",
          "verify": "auth-verify-otp-button"
        }
      },
      "OnboardingWizard": {
        "description": "8-step wizard with sticky progress + large cards. Steps: name, birthday (18+), gender, looking for, photos (up to 6), bio, interests, vibe-check prompts.",
        "components": ["Progress", "Card", "Button", "Input", "Textarea", "Calendar", "ToggleGroup", "Badge"],
        "step_progress": {
          "style": "Top sticky bar with step title + thin progress line.",
          "class_recipe": "sticky top-0 z-20 bg-[color:var(--vo-paper)]/95 backdrop-blur-md border-b border-[color:var(--vo-border)] px-4 py-3"
        },
        "photo_grid": {
          "layout": "2 columns on mobile, first slot is ‘cover’. Each tile has add/replace, reorder handle, delete.",
          "tile": "aspect-square rounded-[18px] border border-dashed border-[color:var(--vo-border)] bg-white overflow-hidden",
          "filled_tile": "border-solid",
          "microinteraction": "On hover/press show action overlay (opacity transition only)."
        },
        "interest_chips": {
          "chip": "inline-flex items-center h-9 px-3 rounded-full border border-[color:var(--vo-border)] bg-white text-sm",
          "chip_selected": "border-[color:var(--vo-ocean)] bg-[rgba(14,165,164,0.10)] text-[color:var(--vo-ink)]"
        },
        "data_testids": {
          "wizard": "onboarding-wizard",
          "next": "onboarding-next-button",
          "back": "onboarding-back-button",
          "photo_add": "onboarding-photo-add-button",
          "birthday_calendar": "onboarding-birthday-calendar"
        }
      },
      "DiscoverCardStack": {
        "fresh_twist": "‘Stamp + sticker’ feedback: as you drag, a corner stamp appears (LIKE / PASS / VOILA) with a subtle paper texture and slight rotation. The stack behind is slightly tilted with depth shadows.",
        "card_layout": {
          "photo_first": true,
          "structure": [
            "Full-bleed photo carousel",
            "Bottom info tray (solid surface, not gradient) that slides up slightly on tap",
            "Top-left verification badge + distance pill",
            "Top-right compatibility ring"
          ],
          "info_tray": "Solid white tray with rounded top corners (24px) and a thin border. Contains name/age, shared chips, prompt answers."
        },
        "class_recipe": {
          "stack_area": "relative h-[calc(100dvh-160px)] px-4 pt-4",
          "card": "absolute inset-x-4 top-4 bottom-24 rounded-[24px] overflow-hidden bg-white border border-[color:var(--vo-border)] shadow-[0_18px_50px_rgba(11,18,32,0.10)]",
          "photo": "h-full w-full object-cover",
          "info_tray": "absolute inset-x-0 bottom-0 bg-white/98 backdrop-blur-sm border-t border-[color:var(--vo-border)] rounded-t-[24px] p-4"
        },
        "swipe_feedback": {
          "like_stamp": "bg-[rgba(22,163,74,0.12)] text-[color:var(--vo-like)] border border-[rgba(22,163,74,0.35)]",
          "pass_stamp": "bg-[rgba(225,29,72,0.10)] text-[color:var(--vo-pass)] border border-[rgba(225,29,72,0.30)]",
          "voila_stamp": "bg-[rgba(37,99,235,0.10)] text-[color:var(--vo-voila)] border border-[rgba(37,99,235,0.30)]",
          "stamp_class": "absolute top-5 left-5 rotate-[-10deg] rounded-[16px] px-3 py-2 text-sm font-semibold tracking-wide"
        },
        "action_dock": {
          "buttons": ["pass", "voila", "like"],
          "layout": "Three circular buttons with different sizes (center bigger).",
          "class_recipe": {
            "dock": "absolute inset-x-0 bottom-6 flex items-center justify-center gap-5",
            "btn": "h-14 w-14 rounded-full border border-[color:var(--vo-border)] bg-white shadow-[0_10px_30px_rgba(11,18,32,0.10)]",
            "btn_center": "h-16 w-16",
            "icon": "h-6 w-6"
          },
          "data_testids": {
            "pass": "discover-pass-button",
            "voila": "discover-voila-button",
            "like": "discover-like-button"
          }
        }
      },
      "FiltersSheet": {
        "description": "Bottom sheet with age range + distance sliders + show-me radio group.",
        "use": "Use shadcn Drawer (vaul) or Sheet. Prefer Drawer for mobile feel.",
        "class_recipe": {
          "content": "rounded-t-[24px] border border-[color:var(--vo-border)] bg-white",
          "section": "px-4 py-3",
          "label": "text-sm font-medium",
          "helper": "text-xs text-muted-foreground"
        },
        "data_testids": {
          "open": "filters-open-button",
          "age_slider": "filters-age-slider",
          "distance_slider": "filters-distance-slider",
          "apply": "filters-apply-button",
          "reset": "filters-reset-button"
        }
      },
      "MatchModal": {
        "description": "‘Voila!’ match popup: clean, celebratory, not cheesy. Use Dialog with a soft bloom behind avatars.",
        "visual": "Two avatars overlapping in a figure-8 layout, with a subtle ‘bloom’ ring (solid color wash, not gradient-heavy).",
        "motion": "Modal pops in (scale 0.96→1, opacity 0→1). Bloom ring expands slightly. Confetti optional via lightweight canvas (only inside modal).",
        "class_recipe": {
          "overlay": "bg-[rgba(11,18,32,0.55)]",
          "panel": "rounded-[24px] border border-[color:var(--vo-border)] bg-white shadow-[0_30px_90px_rgba(11,18,32,0.18)] p-5",
          "title": "font-display text-2xl",
          "cta": "h-12 rounded-[14px]"
        },
        "data_testids": {
          "modal": "match-modal",
          "say_hi": "match-say-hi-button",
          "keep_swiping": "match-keep-swiping-button"
        }
      },
      "LikesGrid": {
        "description": "Grid of people who liked you. Each tile shows photo + name + quick like-back.",
        "class_recipe": {
          "grid": "grid grid-cols-2 gap-3 px-4 pt-4 pb-24",
          "tile": "relative overflow-hidden rounded-[20px] border border-[color:var(--vo-border)] bg-white shadow-[0_10px_30px_rgba(11,18,32,0.08)]",
          "like_back": "absolute bottom-3 right-3 h-11 w-11 rounded-full bg-white/92 backdrop-blur border border-[color:var(--vo-border)]"
        },
        "data_testids": {
          "tile": "likes-grid-tile",
          "like_back": "likes-like-back-button"
        }
      },
      "ChatsList": {
        "description": "List rows with avatar, name, last message, time, unread badge.",
        "class_recipe": {
          "row": "flex items-center gap-3 px-4 py-3",
          "row_press": "active:bg-[color:var(--vo-surface-2)]",
          "unread": "ml-auto inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[color:var(--vo-ocean)] text-white text-xs px-2"
        },
        "data_testids": {
          "row": "chats-list-row"
        }
      },
      "ChatRoom": {
        "description": "Bubbles with soft corners, clear hierarchy, typing indicator, read receipts.",
        "bubble_styles": {
          "incoming": "max-w-[78%] rounded-[18px] rounded-tl-[6px] bg-[color:var(--vo-surface-2)] text-[color:var(--vo-ink)] px-3 py-2",
          "outgoing": "max-w-[78%] rounded-[18px] rounded-tr-[6px] bg-[rgba(14,165,164,0.12)] text-[color:var(--vo-ink)] px-3 py-2 border border-[rgba(14,165,164,0.22)]"
        },
        "composer": {
          "layout": "Sticky bottom composer above bottom safe area. Input grows to 4 lines.",
          "class_recipe": "sticky bottom-0 bg-[color:var(--vo-paper)] border-t border-[color:var(--vo-border)] px-4 py-3"
        },
        "icebreaker_drawer": {
          "description": "Drawer with ‘Vibe-check’ chips (tap to insert).",
          "chip": "h-10 px-4 rounded-full border border-[color:var(--vo-border)] bg-white"
        },
        "data_testids": {
          "message_input": "chat-message-input",
          "send": "chat-send-button",
          "icebreakers_open": "chat-icebreakers-open-button",
          "bubble": "chat-message-bubble"
        }
      },
      "Profile": {
        "description": "Profile as a ‘card preview’ + edit actions. Keep it editorial and calm.",
        "sections": ["Preview card", "Interests", "Prompts", "Preferences", "Danger zone"],
        "danger_zone": "Use AlertDialog for logout/delete with clear copy.",
        "data_testids": {
          "edit": "profile-edit-button",
          "preferences": "profile-preferences-button",
          "logout": "profile-logout-button"
        }
      },
      "EmptyLoadingErrorStates": {
        "empty": "Use friendly, short copy. Provide a single primary action. Use an illustration-like icon from lucide-react (no emojis).",
        "loading": "Use shadcn Skeleton for cards, chat rows, and photo grid tiles.",
        "error": "Use Alert component with a clear retry button.",
        "data_testids": {
          "empty": "empty-state",
          "loading": "loading-skeleton",
          "error": "error-alert"
        }
      }
    }
  },
  "libraries_and_integrations": {
    "required": [
      {
        "name": "framer-motion",
        "usage": "Swipe deck, tab indicator, modal pop, subtle entrances",
        "install": "npm i framer-motion"
      },
      {
        "name": "lucide-react",
        "usage": "Icons (no emojis)",
        "install": "npm i lucide-react"
      },
      {
        "name": "sonner",
        "usage": "Toasts",
        "install": "npm i sonner"
      },
      {
        "name": "vaul",
        "usage": "Mobile drawers (already used by shadcn Drawer)",
        "install": "npm i vaul"
      },
      {
        "name": "input-otp",
        "usage": "OTP input (already used by shadcn InputOTP)",
        "install": "npm i input-otp"
      }
    ],
    "optional": [
      {
        "name": "lottie-react",
        "usage": "Match celebration animation fallback (keep subtle)",
        "install": "npm i lottie-react"
      }
    ]
  },
  "image_urls": {
    "note": "Image provider tool was unavailable in this environment. Use these categories as placeholders; main agent should source real images later or use user-uploaded photos.",
    "categories": [
      {
        "category": "welcome_background",
        "description": "Abstract soft grain background (very subtle).",
        "urls": []
      },
      {
        "category": "empty_states",
        "description": "Minimal line illustrations or subtle blobs (SVG).",
        "urls": []
      },
      {
        "category": "demo_profiles",
        "description": "If demo data is needed, use diverse, consented stock portraits.",
        "urls": []
      }
    ]
  },
  "instructions_to_main_agent": {
    "do_first": [
      "Replace CRA default App.css centering patterns; do not use .App { text-align:center }.",
      "Extend src/index.css :root tokens with the Voiladi palette (map to shadcn variables + add --vo-* custom props).",
      "Add Google Fonts (Space Grotesk + Figtree) in public/index.html and extend tailwind.config.js fontFamily.",
      "Ensure every interactive element and key info element has data-testid in kebab-case.",
      "Implement AppShell with desktop phone-shell wrapper and ambient background glows (solid page background, no transparency)."
    ],
    "implementation_notes_js_only": [
      "All components are .jsx; keep named exports for components and default exports for pages.",
      "Use shadcn/ui primitives from /src/components/ui (Button, Drawer, Dialog, InputOTP, Slider, Tabs, Skeleton, etc.).",
      "Avoid HTML-native dropdown/calendar/toast; use shadcn equivalents only."
    ],
    "micro_interactions_checklist": [
      "Buttons: active:scale-[0.98] + transition-colors (no transition-all)",
      "Swipe card: real-time drag with rotation up to 8deg; stamp opacity ramps with drag distance",
      "Match modal: pop-in spring + subtle bloom ring expansion",
      "Bottom nav: animated pill indicator using layoutId",
      "Sheets: vaul drawer with backdrop blur and rounded top"
    ]
  }
}

<General UI UX Design Guidelines>  
    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms
    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text
   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json

 **GRADIENT RESTRICTION RULE**
NEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc
NEVER use dark gradients for logo, testimonial, footer etc
NEVER let gradients cover more than 20% of the viewport.
NEVER apply gradients to text-heavy content or reading areas.
NEVER use gradients on small UI elements (<100px width).
NEVER stack multiple gradient layers in the same viewport.

**ENFORCEMENT RULE:**
    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors

**How and where to use:**
   • Section backgrounds (not content backgrounds)
   • Hero section header content. Eg: dark to light to dark color
   • Decorative overlays and accent elements only
   • Hero section with 2-3 mild color
   • Gradients creation can be done for any angle say horizontal, vertical or diagonal

- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**

</Font Guidelines>

- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. 
   
- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.

- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.
   
- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly
    Eg: - if it implies playful/energetic, choose a colorful scheme
           - if it implies monochrome/minimal, choose a black–white/neutral scheme

**Component Reuse:**
	- Prioritize using pre-existing components from src/components/ui when applicable
	- Create new components that match the style and conventions of existing components when needed
	- Examine existing components to understand the project's component patterns before creating new ones

**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component

**Best Practices:**
	- Use Shadcn/UI as the primary component library for consistency and accessibility
	- Import path: ./components/[component-name]

**Export Conventions:**
	- Components MUST use named exports (export const ComponentName = ...)
	- Pages MUST use default exports (export default function PageName() {...})

**Toasts:**
  - Use `sonner` for toasts"
  - Sonner component are located in `/app/src/components/ui/sonner.tsx`

Use 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.
</General UI UX Design Guidelines>
