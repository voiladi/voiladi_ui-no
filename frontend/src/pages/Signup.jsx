import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Spinner } from "@/components/Loading";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

/* Shared email + password screen. mode = "signup" | "login". */
export const EmailPasswordForm = ({ mode }) => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signup = mode === "signup";
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && password.length >= 6;

  const submit = async (e) => {
    e?.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(signup ? "/auth/register" : "/auth/login", { email: email.trim(), password });
      login(data.token, data.user);
      navigate(data.user?.onboarded ? "/discover" : "/onboarding", { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col px-5 pb-6 pt-3" data-testid={signup ? "signup-page" : "login-page"}>
      <button type="button" onClick={() => navigate("/welcome")} className="vo-icon-plain -ml-2" aria-label="Back" data-testid="auth-back-button">
        <ArrowLeft className="h-6 w-6" strokeWidth={2} />
      </button>

      <h1 className="vo-h1 mt-6">{signup ? "Create your account" : "Welcome back"}</h1>
      <p className="vo-sub mt-1.5">{signup ? "Start with your email." : "Log in with your email."}</p>

      <form className="mt-8 flex flex-1 flex-col" onSubmit={submit} noValidate>
        <label className="vo-label mb-2" htmlFor="auth-email">
          Email
        </label>
        <input
          id="auth-email"
          type="email"
          autoFocus
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`vo-input ${error ? "vo-input-error" : ""}`}
          data-testid="auth-email-input"
        />

        <label className="vo-label mb-2 mt-5" htmlFor="auth-password">
          Password
        </label>
        <div className="relative">
          <input
            id="auth-password"
            type={show ? "text" : "password"}
            autoComplete={signup ? "new-password" : "current-password"}
            placeholder={signup ? "At least 6 characters" : "Your password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`vo-input pr-12 ${error ? "vo-input-error" : ""}`}
            data-testid="auth-password-input"
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-mute hover:text-ink" aria-label={show ? "Hide password" : "Show password"} data-testid="auth-toggle-password-button">
            {show ? <EyeOff className="h-5 w-5" strokeWidth={1.75} /> : <Eye className="h-5 w-5" strokeWidth={1.75} />}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-[14px] text-red" data-testid="auth-error">
            {error}
          </p>
        )}

        <div className="mt-auto pt-10">
          <button type="submit" className="vo-btn-primary w-full" disabled={!valid || busy} aria-busy={busy} data-testid="auth-continue-button">
            {busy ? <Spinner size={20} stroke={2} /> : signup ? "Continue" : "Log in"}
          </button>
          {!signup && (
            <button type="button" className="vo-btn-ghost mt-2 w-full text-[15px] text-mute" onClick={() => navigate("/login/phone")} data-testid="auth-phone-login-link">
              Log in with phone number instead
            </button>
          )}
        </div>
        <p className="mt-8 text-center text-[15px] text-mute">
          {signup ? "Already have an account? " : "Don't have an account? "}
          <button type="button" className="vo-link text-[15px]" onClick={() => navigate(signup ? "/login" : "/signup")} data-testid={signup ? "auth-go-login-link" : "auth-go-signup-link"}>
            {signup ? "Log in" : "Create one"}
          </button>
        </p>
      </form>
    </div>
  );
};

export default function Signup() {
  return <EmailPasswordForm mode="signup" />;
}
