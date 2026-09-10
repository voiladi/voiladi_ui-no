import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { SoftPageHeader, SoftCard } from "@/components/SoftUI";
import { Spinner } from "@/components/Loading";
import { notice } from "@/lib/feedback";
import { api, errMsg } from "@/lib/api";

/* Settings > Account > Email: change (or add) the email on the account. Password accounts confirm their password. */
export default function ChangeEmail() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const needsPassword = !!user?.has_password;
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && (!needsPassword || password.length > 0);

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await api.put("/auth/email", { email: email.trim(), password: needsPassword ? password : undefined });
      setUser(data);
      notice("Email updated");
      navigate("/settings");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="vo-neu-page flex min-h-full flex-col px-4 pb-10" data-testid="change-email-page">
      <SoftPageHeader title="Email" onBack={() => navigate("/settings")} backTestId="change-email-back-button" />

      <SoftCard className="mt-3 px-4 py-3.5" testId="change-email-current">
        <span className="block text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-mute">Current email</span>
        <span className="mt-1.5 block truncate text-[17px] font-semibold tracking-[-0.01em] text-ink" data-testid="change-email-current-value">
          {user?.email || "No email yet"}
        </span>
      </SoftCard>

      <form
        className="mt-5 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="New email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          className={`vo-soft-sunken h-[52px] w-full rounded-[16px] px-4 text-[16px] tracking-[-0.01em] text-ink outline-none placeholder:text-mute ${error ? "ring-1.5 ring-red" : ""}`}
          data-testid="change-email-input"
        />
        {needsPassword && (
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            className="vo-soft-sunken h-[52px] w-full rounded-[16px] px-4 text-[16px] tracking-[-0.01em] text-ink outline-none placeholder:text-mute"
            data-testid="change-email-password-input"
          />
        )}
        {error && (
          <p className="px-1 text-[14px] font-medium text-red" role="alert" data-testid="change-email-error">
            {error}
          </p>
        )}
        <p className="px-1 text-[13px] leading-[17px] text-mute">{needsPassword ? "You'll use the new email to log in." : "Add an email so you can also log in without your phone."}</p>
        <button type="submit" disabled={!valid || saving} aria-busy={saving} className="mt-2 inline-flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[17px] font-semibold text-onink active:scale-[0.98] disabled:opacity-40" style={{ transitionProperty: "transform, opacity", transitionDuration: "120ms" }} data-testid="change-email-save-button">
          {saving ? <Spinner size={20} stroke={2.5} /> : "Save"}
        </button>
      </form>
    </div>
  );
}
