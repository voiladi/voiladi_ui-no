import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/Logo";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { slideX } from "@/lib/motion";

const COUNTRIES = [
  ["+91", "IN", "India"], ["+1", "US", "United States / Canada"], ["+44", "GB", "United Kingdom"], ["+61", "AU", "Australia"],
  ["+971", "AE", "UAE"], ["+65", "SG", "Singapore"], ["+49", "DE", "Germany"], ["+33", "FR", "France"], ["+34", "ES", "Spain"],
  ["+39", "IT", "Italy"], ["+31", "NL", "Netherlands"], ["+351", "PT", "Portugal"], ["+55", "BR", "Brazil"], ["+52", "MX", "Mexico"],
  ["+81", "JP", "Japan"], ["+82", "KR", "South Korea"], ["+62", "ID", "Indonesia"], ["+63", "PH", "Philippines"], ["+66", "TH", "Thailand"],
  ["+92", "PK", "Pakistan"], ["+880", "BD", "Bangladesh"], ["+94", "LK", "Sri Lanka"], ["+977", "NP", "Nepal"], ["+234", "NG", "Nigeria"],
  ["+254", "KE", "Kenya"], ["+27", "ZA", "South Africa"], ["+90", "TR", "Turkey"], ["+7", "RU", "Russia"], ["+46", "SE", "Sweden"], ["+353", "IE", "Ireland"],
];

const guessCountry = () => {
  const lang = (navigator.language || "").toUpperCase();
  const region = lang.split("-")[1];
  const hit = COUNTRIES.find((c) => c[1] === region);
  return hit ? hit[0] : "+91";
};

export default function Auth() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState("phone");
  const [cc, setCc] = useState(guessCountry);
  const [number, setNumber] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState(null);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState("");
  const otpRef = useRef(null);

  const fullPhone = useMemo(() => `${cc}${number.replace(/\D/g, "")}`, [cc, number]);
  const validPhone = number.replace(/\D/g, "").length >= 7;

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const requestOtp = async () => {
    if (!validPhone || sending) return;
    setSending(true);
    setError("");
    try {
      const { data } = await api.post("/auth/request-otp", { phone: fullPhone });
      setDevCode(data.dev_code || null);
      setResendIn(data.resend_in || 30);
      setCode("");
      setStep("otp");
      setTimeout(() => otpRef.current?.focus(), 250);
    } catch (e) {
      const msg = errMsg(e);
      setError(msg);
      if (e?.response?.status === 429) {
        setStep("otp");
      }
    } finally {
      setSending(false);
    }
  };

  const verify = async (value) => {
    const c = value || code;
    if (c.length !== 6 || verifying) return;
    setVerifying(true);
    setError("");
    try {
      const { data } = await api.post("/auth/verify-otp", { phone: fullPhone, code: c });
      login(data.token, data.user);
      navigate(data.user?.profile_complete && data.user?.onboarded ? "/discover" : "/onboarding", { replace: true });
    } catch (e) {
      setError(errMsg(e));
      setCode("");
      setTimeout(() => otpRef.current?.focus(), 50);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col px-6 pb-8 pt-5" data-testid="auth-page">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => (step === "otp" ? setStep("phone") : navigate("/welcome"))}
          className="vo-icon-btn"
          aria-label="Back"
          data-testid="auth-back-button"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Logo size={28} textClass="text-[18px]" />
        <span className="w-10" />
      </div>

      <AnimatePresence mode="wait">
        {step === "phone" ? (
          <motion.div key="phone" {...slideX(1)} className="mt-10 flex flex-1 flex-col">
            <p className="vo-eyebrow mb-3">Step 1 of 2</p>
            <h1 className="vo-h1">What's your number?</h1>
            <p className="mt-2 text-[15px] text-mute">We'll text you a code. Your number stays private and never shows on your profile.</p>

            <form
              className="mt-8 flex flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                requestOtp();
              }}
            >
              <div className="flex gap-2.5">
                <Select value={cc} onValueChange={setCc}>
                  <SelectTrigger className="h-12 w-[96px] shrink-0 rounded-btn border-transparent bg-surface2 px-3 text-[17px] font-semibold focus:ring-0 focus:border-line focus:bg-white" data-testid="auth-country-select">
                    <SelectValue>{cc}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px] rounded-card border-line shadow-float">
                    {COUNTRIES.map(([code, iso, name]) => (
                      <SelectItem key={code + iso} value={code} className="rounded-[10px] py-2.5">
                        <span className="font-semibold">{code}</span> <span className="ml-1.5 text-mute">{name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  autoFocus
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="Phone number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value.replace(/[^\d\s]/g, "").slice(0, 16))}
                  className="vo-input flex-1 font-display text-[20px] font-semibold tracking-wide"
                  data-testid="auth-phone-input"
                />
              </div>
              {error && (
                <p className="mt-3 text-[14px] text-danger" data-testid="auth-error">
                  {error}
                </p>
              )}
              <div className="mt-auto pt-8">
                <button type="submit" className="vo-btn-primary w-full" disabled={!validPhone || sending} data-testid="auth-send-otp-button">
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Send code <ArrowRight className="h-5 w-5" /></>}
                </button>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-mute">
                  <ShieldCheck className="h-3.5 w-3.5" /> Standard SMS rates may apply.
                </p>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div key="otp" {...slideX(1)} className="mt-10 flex flex-1 flex-col">
            <p className="vo-eyebrow mb-3">Step 2 of 2</p>
            <h1 className="vo-h1">Enter your code</h1>
            <p className="mt-2 text-[15px] text-mute">
              Sent to <span className="font-semibold text-ink">{fullPhone}</span>.{" "}
              <button type="button" className="font-semibold text-tint hover:text-tint-dark" onClick={() => setStep("phone")} data-testid="auth-change-number-button">
                Change
              </button>
            </p>

            <div className="mt-8" data-testid="auth-otp-input">
              <InputOTP
                ref={otpRef}
                maxLength={6}
                value={code}
                pattern={REGEXP_ONLY_DIGITS}
                onChange={(v) => {
                  setCode(v);
                  setError("");
                }}
                onComplete={(v) => verify(v)}
                containerClassName="justify-between gap-2"
                disabled={verifying}
              >
                <InputOTPGroup className="w-full justify-between gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="h-[56px] w-[46px] rounded-btn border border-transparent bg-surface2 font-display text-[24px] font-semibold shadow-none first:rounded-btn last:rounded-btn data-[active=true]:border-tint data-[active=true]:bg-white data-[active=true]:ring-0"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-[14px] text-danger" data-testid="auth-error">
                {error}
              </motion.p>
            )}

            {devCode && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-6 rounded-card bg-surface2 p-4" data-testid="auth-dev-code-card">
                <div className="text-[12px] font-semibold text-mute">Test mode</div>
                <p className="mt-1 text-[14px] leading-snug text-ink">
                  SMS isn't connected for this number, so here's your code:{" "}
                  <span className="font-display text-[18px] font-semibold tracking-widest" data-testid="auth-dev-code">{devCode}</span>
                </p>
                <button
                  type="button"
                  className="vo-btn-primary mt-3 h-10 w-full text-[14px]"
                  onClick={() => {
                    setCode(devCode);
                    verify(devCode);
                  }}
                  data-testid="auth-use-dev-code-button"
                >
                  Use this code
                </button>
              </motion.div>
            )}

            <div className="mt-auto pt-8">
              <button type="button" className="vo-btn-primary w-full" disabled={code.length !== 6 || verifying} onClick={() => verify()} data-testid="auth-verify-otp-button">
                {verifying ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify"}
              </button>
              <button type="button" className="vo-btn-ghost mt-2 w-full" disabled={resendIn > 0 || sending} onClick={requestOtp} data-testid="auth-resend-button">
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
