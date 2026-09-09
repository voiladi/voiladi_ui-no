import React, { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const COUNTRIES = [
  ["+91", "IN", "India"], ["+1", "US", "United States / Canada"], ["+44", "GB", "United Kingdom"], ["+61", "AU", "Australia"],
  ["+971", "AE", "UAE"], ["+65", "SG", "Singapore"], ["+49", "DE", "Germany"], ["+33", "FR", "France"], ["+34", "ES", "Spain"],
  ["+39", "IT", "Italy"], ["+31", "NL", "Netherlands"], ["+351", "PT", "Portugal"], ["+55", "BR", "Brazil"], ["+52", "MX", "Mexico"],
  ["+81", "JP", "Japan"], ["+82", "KR", "South Korea"], ["+62", "ID", "Indonesia"], ["+63", "PH", "Philippines"], ["+66", "TH", "Thailand"],
  ["+92", "PK", "Pakistan"], ["+880", "BD", "Bangladesh"], ["+94", "LK", "Sri Lanka"], ["+977", "NP", "Nepal"], ["+234", "NG", "Nigeria"],
  ["+254", "KE", "Kenya"], ["+27", "ZA", "South Africa"], ["+90", "TR", "Turkey"], ["+7", "RU", "Russia"], ["+46", "SE", "Sweden"], ["+353", "IE", "Ireland"],
  ["+373", "MD", "Moldova"], ["+40", "RO", "Romania"],
];

export const flagOf = (iso) => String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

export const guessCountry = () => {
  const lang = (navigator.language || "").toUpperCase();
  const region = lang.split("-")[1];
  const hit = COUNTRIES.find((c) => c[1] === region);
  return hit ? hit[0] : "+91";
};

/* Phone field as photographed: [flag +91 v] | number. `cc` is the dial code.
   The visible trigger is styled; a transparent native <select> sits on top so the picker is the OS-native one on
   phones (iOS wheel / Android sheet) and works reliably with keyboard + automation. */
export const PhoneField = ({ cc, onCc, number, onNumber, onEnter, autoFocus = true, error = false }) => {
  const iso = (COUNTRIES.find((c) => c[0] === cc) || COUNTRIES[0])[1];
  return (
    <div className={`flex h-12 items-center rounded-[12px] bg-surface ${error ? "ring-1.5 ring-red" : ""}`} data-testid="auth-phone-field">
      <div className="relative flex h-12 shrink-0 items-center gap-1 rounded-l-[12px] px-3 text-[16px] font-medium text-ink" data-testid="auth-country-trigger">
        <span className="text-[18px] leading-none" aria-hidden="true">{flagOf(iso)}</span>
        <span data-testid="auth-country-code">{cc}</span>
        <ChevronDown className="h-4 w-4 text-mute" aria-hidden="true" />
        <select
          value={cc}
          onChange={(e) => onCc(e.target.value)}
          aria-label="Country code"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          data-testid="auth-country-select"
        >
          {COUNTRIES.map(([code, iso2, name]) => (
            <option key={code + iso2} value={code} data-testid={`auth-country-option-${iso2.toLowerCase()}`}>
              {`${code} ${name}`}
            </option>
          ))}
        </select>
      </div>
      <span className="h-6 w-px bg-line" />
      <input
        autoFocus={autoFocus}
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="Phone number"
        value={number}
        onChange={(e) => onNumber(e.target.value.replace(/[^\d\s]/g, "").slice(0, 16))}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        className="h-12 min-w-0 flex-1 bg-transparent px-3 text-[16px] font-medium text-ink focus:outline-none"
        data-testid="auth-phone-input"
      />
    </div>
  );
};

/* Six code boxes. */
export const OtpBoxes = forwardRef(({ value, onChange, onComplete, disabled }, ref) => (
  <div data-testid="auth-otp-input">
    <InputOTP ref={ref} maxLength={6} value={value} pattern={REGEXP_ONLY_DIGITS} onChange={onChange} onComplete={onComplete} containerClassName="justify-between gap-2" disabled={disabled}>
      <InputOTPGroup className="w-full justify-between gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <InputOTPSlot
            key={i}
            index={i}
            className="h-[56px] w-[48px] rounded-[12px] border border-line bg-bg text-[24px] font-medium text-ink shadow-none first:rounded-[12px] last:rounded-[12px] data-[active=true]:border-ink data-[active=true]:ring-0"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  </div>
));
OtpBoxes.displayName = "OtpBoxes";

export const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/* Shown only when the number is a test number (no SMS): the code is surfaced in-app. */
export const DevCodeCard = ({ code, onUse }) => (
  <div className="vo-card mt-6 p-4" data-testid="auth-dev-code-card">
    <div className="text-[13px] font-medium text-mute">Test mode</div>
    <p className="mt-1 text-[14px] leading-snug text-ink">
      SMS isn't connected for this number. Your code: <span className="text-[18px] font-bold tracking-[0.2em]" data-testid="auth-dev-code">{code}</span>
    </p>
    <button type="button" className="vo-btn-secondary mt-3 h-10 w-full text-[14px]" onClick={onUse} data-testid="auth-use-dev-code-button">
      Use this code
    </button>
  </div>
);
