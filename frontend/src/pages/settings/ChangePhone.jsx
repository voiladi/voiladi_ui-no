import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { SoftPageHeader, SoftCard } from "@/components/SoftUI";
import { PhoneField, OtpBoxes, DevCodeCard, mmss, guessCountry } from "@/components/PhoneOtp";
import { Spinner } from "@/components/Loading";
import { notice } from "@/lib/feedback";
import { api, errMsg } from "@/lib/api";
import { formatPhone } from "@/lib/phone";

/* Settings > Account > Phone: enter a new number, confirm it with the 6-digit code, it replaces the old one. */
export default function ChangePhone() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [step, setStep] = useState("phone"); // phone | otp
  const [cc, setCc] = useState(guessCountry());
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState(null);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const otpRef = useRef(null);

  const digits = number.replace(/\D/g, "");
  const fullPhone = `${cc}${digits}`;
  const validPhone = digits.length >= 7 && digits.length <= 15;
  const same = user?.phone && user.phone === fullPhone;

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const requestOtp = async () => {
    if (!validPhone || saving) return;
    if (same) {
      setError("That's already your number");
      return;
    }
    setSaving(true);
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
      setSaving(false);
    }
  };

  const verify = async (value) => {
    const c = value || code;
    if (c.length !== 6 || saving) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post("/auth/verify-phone", { phone: fullPhone, code: c });
      setUser(data);
      notice("Phone number updated");
      navigate("/settings");
    } catch (e) {
      setError(errMsg(e));
      setCode("");
      setTimeout(() => otpRef.current?.focus(), 50);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="vo-neu-page flex min-h-full flex-col px-4 pb-10" data-testid="change-phone-page">
      <SoftPageHeader
        title="Phone"
        onBack={() => {
          if (step === "otp") {
            setStep("phone");
            setError("");
          } else navigate("/settings");
        }}
        backTestId="change-phone-back-button"
      />

      <SoftCard className="mt-3 px-4 py-3.5" testId="change-phone-current">
        <span className="block text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-mute">Current number</span>
        <span className="mt-1.5 block truncate text-[17px] font-semibold tracking-[-0.01em] text-ink" data-testid="change-phone-current-value">
          {user?.phone ? formatPhone(user.phone) : "No number yet"}
        </span>
      </SoftCard>

      {step === "phone" ? (
        <div className="mt-5 space-y-3" data-testid="change-phone-step-number">
          <PhoneField cc={cc} onCc={setCc} number={number} onNumber={(v) => { setNumber(v); setError(""); }} onEnter={requestOtp} error={!!error} className="vo-soft-sunken !h-[52px] !rounded-[16px]" />
          {error && (
            <p className="px-1 text-[14px] font-medium text-red" role="alert" data-testid="change-phone-error">
              {error}
            </p>
          )}
          <p className="px-1 text-[13px] leading-[17px] text-mute">We'll text a 6-digit code to confirm it's yours.</p>
          <button type="button" onClick={requestOtp} disabled={!validPhone || saving} aria-busy={saving} className="mt-2 inline-flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[17px] font-semibold text-onink active:scale-[0.98] disabled:opacity-40" style={{ transitionProperty: "transform, opacity", transitionDuration: "120ms" }} data-testid="change-phone-send-code-button">
            {saving ? <Spinner size={20} stroke={2.5} /> : "Send code"}
          </button>
        </div>
      ) : (
        <div className="mt-5" data-testid="change-phone-step-otp">
          <p className="px-1 text-[15px] leading-[20px] text-mute">
            Enter the code we sent to <span className="font-semibold text-ink" data-testid="change-phone-target">{formatPhone(fullPhone)}</span>
          </p>
          <div className="mt-4">
            <OtpBoxes ref={otpRef} value={code} onChange={(v) => { setCode(v); setError(""); }} onComplete={verify} disabled={saving} />
          </div>
          {error && (
            <p className="mt-3 px-1 text-[14px] font-medium text-red" role="alert" data-testid="change-phone-error">
              {error}
            </p>
          )}
          {devCode && <DevCodeCard code={devCode} onUse={() => { setCode(devCode); verify(devCode); }} />}
          <div className="mt-5 flex items-center justify-between px-1 text-[14px]">
            <button type="button" className="font-medium text-mute active:opacity-60" onClick={() => { setStep("phone"); setError(""); }} data-testid="change-phone-edit-number-button">
              Change number
            </button>
            {resendIn > 0 ? (
              <span className="tabular-nums text-mute" data-testid="change-phone-resend-timer">Resend in {mmss(resendIn)}</span>
            ) : (
              <button type="button" className="font-semibold text-ink active:opacity-60" onClick={requestOtp} disabled={saving} data-testid="change-phone-resend-button">
                Resend code
              </button>
            )}
          </div>
          <button type="button" onClick={() => verify()} disabled={code.length !== 6 || saving} aria-busy={saving} className="mt-6 inline-flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[17px] font-semibold text-onink active:scale-[0.98] disabled:opacity-40" style={{ transitionProperty: "transform, opacity", transitionDuration: "120ms" }} data-testid="change-phone-verify-button">
            {saving ? <Spinner size={20} stroke={2.5} /> : "Confirm"}
          </button>
        </div>
      )}
    </div>
  );
}
