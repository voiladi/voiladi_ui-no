import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Lock } from "lucide-react";
import { Spinner } from "@/components/Loading";
import { PhoneField, OtpBoxes, DevCodeCard, guessCountry, mmss } from "@/components/PhoneOtp";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { slideX } from "@/lib/motion";

/* Phone-only login for accounts created with a number (no email yet). */
export default function PhoneLogin() {
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
      setError(errMsg(e));
      if (e?.response?.status === 429) setStep("otp");
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
      navigate(data.user?.onboarded ? "/discover" : "/onboarding", { replace: true });
    } catch (e) {
      setError(errMsg(e));
      setCode("");
      setTimeout(() => otpRef.current?.focus(), 50);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col px-5 pb-6 pt-3" data-testid="auth-page">
      <button type="button" onClick={() => (step === "otp" ? setStep("phone") : navigate("/login/email"))} className="vo-icon-plain -ml-2" aria-label="Back" data-testid="auth-back-button">
        <ArrowLeft className="h-6 w-6" strokeWidth={2} />
      </button>

      <AnimatePresence mode="wait">
        {step === "phone" ? (
          <motion.div key="phone" {...slideX(1)} className="mt-6 flex flex-1 flex-col">
            <h1 className="vo-h1">Log in with your number</h1>
            <p className="vo-sub mt-1.5">We'll send you a verification code.</p>
            <form
              className="mt-8 flex flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                requestOtp();
              }}
            >
              <PhoneField cc={cc} onCc={setCc} number={number} onNumber={setNumber} error={!!error} />
              {error && (
                <p className="mt-3 text-[14px] text-red" data-testid="auth-error">
                  {error}
                </p>
              )}
              <div className="mt-auto pt-8">
                <button type="submit" className="vo-btn-primary w-full" disabled={!validPhone || sending} aria-busy={sending} data-testid="auth-send-otp-button">
                  {sending ? <Spinner size={20} stroke={2} /> : "Continue"}
                </button>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-[13px] text-mute">
                  <Lock className="h-3.5 w-3.5" /> Your number is kept private.
                </p>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div key="otp" {...slideX(1)} className="mt-6 flex flex-1 flex-col">
            <h1 className="vo-h1">Enter the code</h1>
            <p className="vo-sub mt-1.5">
              We've sent a 6-digit code to
              <br />
              <span className="text-ink">{fullPhone}</span>
            </p>
            <div className="mt-10">
              <OtpBoxes
                ref={otpRef}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  setError("");
                }}
                onComplete={(v) => verify(v)}
                disabled={verifying}
              />
            </div>
            {error && (
              <p className="mt-4 text-center text-[14px] text-red" data-testid="auth-error">
                {error}
              </p>
            )}
            <p className="mt-8 text-center text-[13px] text-mute">
              Didn't receive the code?{" "}
              {resendIn > 0 ? (
                <span data-testid="auth-resend-timer">Resend in {mmss(resendIn)}</span>
              ) : (
                <button type="button" className="vo-link text-[13px]" onClick={requestOtp} disabled={sending} aria-busy={sending} data-testid="auth-resend-button">
                  Resend
                </button>
              )}
            </p>
            {devCode && (
              <DevCodeCard
                code={devCode}
                onUse={() => {
                  setCode(devCode);
                  verify(devCode);
                }}
              />
            )}
            <div className="mt-auto pt-8">
              <button type="button" className="vo-btn-primary w-full" disabled={code.length !== 6 || verifying} onClick={() => verify()} data-testid="auth-verify-otp-button">
                {verifying ? <Spinner size={20} stroke={2} /> : "Continue"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
