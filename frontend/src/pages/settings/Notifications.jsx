import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, MessageSquareText, BadgeCheck, Smartphone, BellRing } from "lucide-react";
import { SoftPageHeader, SoftSectionLabel, SoftCard, SoftRow } from "@/components/SoftUI";
import { Switch } from "@/components/ui/switch";
import { Spinner, Skeleton } from "@/components/Loading";
import { api, errMsg } from "@/lib/api";
import { isNativeApp, nativeOpenSettings } from "@/lib/native";
import { notice } from "@/lib/feedback";

/*
 * Settings > Notifications: which phone pushes you get (likes, message requests, messages, verification), the phones
 * registered for this account, and a "Send a test" button. Delivery is Firebase Cloud Messaging via the Android app.
 */
const TYPES = [
  { key: "likes", icon: Heart, label: "Likes", sub: "Someone likes or Super Likes you, and new matches" },
  { key: "requests", icon: MessageCircle, label: "Message requests", sub: "Someone new wants to message you" },
  { key: "messages", icon: MessageSquareText, label: "Messages", sub: "New messages while you're away" },
  { key: "verification", icon: BadgeCheck, label: "Verification", sub: "The result of your selfie review" },
];

export default function NotificationSettings() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [testing, setTesting] = useState(false);

  const load = async () => {
    setError("");
    try {
      const { data: d } = await api.get("/push/prefs");
      setData(d);
    } catch (e) {
      setError(errMsg(e, "Couldn't load your notification settings."));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (key, on) => {
    if (!data) return;
    const prev = data.prefs;
    setData({ ...data, prefs: { ...prev, [key]: on } });
    setSaving(key);
    try {
      const { data: d } = await api.put("/push/prefs", { [key]: on });
      setData((cur) => ({ ...cur, prefs: d.prefs }));
    } catch (e) {
      setData((cur) => ({ ...cur, prefs: prev }));
      notice(errMsg(e));
    } finally {
      setSaving("");
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const { data: d } = await api.post("/push/test");
      notice(d.sent ? "Test notification sent to your phone" : "Sent, but your phone didn't accept it. Reopen the app and try again");
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setTesting(false);
    }
  };

  const devices = data?.devices || [];
  const native = isNativeApp();

  return (
    <div className="vo-neu-page min-h-full px-5 pb-[calc(24px+var(--safe-bottom))]" data-testid="notification-settings-page">
      <SoftPageHeader title="Notifications" onBack={() => navigate("/settings")} backTestId="notification-settings-back-button" />

      {error ? (
        <div className="mt-16 flex flex-col items-center text-center" data-testid="notification-settings-error">
          <p className="text-[17px] font-semibold text-ink">{error}</p>
          <button type="button" className="vo-btn-primary mt-4 px-6" onClick={load}>
            Try again
          </button>
        </div>
      ) : !data ? (
        <div className="mt-7 space-y-3" aria-busy="true" data-testid="notification-settings-loading">
          <Skeleton className="h-[14px] w-[90px]" />
          <Skeleton className="h-[220px] w-full rounded-[26px]" />
          <Skeleton className="h-[14px] w-[70px]" />
          <Skeleton className="h-[64px] w-full rounded-[26px]" />
        </div>
      ) : (
        <>
          <section className="mt-7">
            <SoftSectionLabel>Notify me about</SoftSectionLabel>
            <SoftCard testId="notification-types-card">
              {TYPES.map((t, i) => (
                <SoftRow
                  key={t.key}
                  icon={t.icon}
                  label={t.label}
                  testId={`notification-type-${t.key}`}
                  last={i === TYPES.length - 1}
                  right={
                    saving === t.key ? (
                      <Spinner size={18} stroke={2.2} className="text-mute" />
                    ) : (
                      <Switch
                        checked={!!data.prefs[t.key]}
                        onCheckedChange={(on) => toggle(t.key, on)}
                        aria-label={t.label}
                        className="h-[31px] w-[51px] data-[state=checked]:bg-[#34C759] data-[state=unchecked]:bg-surface2 [&>span]:h-[27px] [&>span]:w-[27px] [&>span]:data-[state=checked]:translate-x-[20px]"
                        data-testid={`notification-switch-${t.key}`}
                      />
                    )
                  }
                />
              ))}
            </SoftCard>
            <p className="mt-2.5 px-1 text-[13px] leading-[18px] text-mute" data-testid="notification-types-hint">
              Message pushes only arrive while you're away from the chat. Everything always shows in the app's Notifications tab.
            </p>
          </section>

          <section className="mt-7">
            <SoftSectionLabel>Your phones</SoftSectionLabel>
            <SoftCard testId="notification-devices-card">
              {devices.length === 0 ? (
                <div className="px-4 py-4" data-testid="notification-no-devices">
                  <p className="text-[16px] font-semibold tracking-[-0.01em] text-ink">No phone connected yet</p>
                  <p className="mt-1 text-[14px] leading-[19px] text-mute">
                    {native
                      ? "Allow notifications for Voiladi in your phone's settings, then reopen the app."
                      : "Install the Voiladi Android app and sign in - your phone shows up here automatically."}
                  </p>
                  {native ? (
                    <button type="button" className="vo-soft-pill mt-3 h-[38px] px-4 text-[14px] font-semibold" onClick={nativeOpenSettings} data-testid="notification-open-settings">
                      Open phone settings
                    </button>
                  ) : (
                    <a href="/voiladi.apk" className="vo-soft-pill mt-3 inline-flex h-[38px] px-4 text-[14px] font-semibold" data-testid="notification-get-app">
                      Get the Android app
                    </a>
                  )}
                </div>
              ) : (
                devices.map((d, i) => (
                  <SoftRow key={i} icon={Smartphone} label={d.device || "Android phone"} value={d.app_version ? `v${d.app_version}` : d.platform} testId="notification-device-row" last={i === devices.length - 1} />
                ))
              )}
            </SoftCard>
          </section>

          <button
            type="button"
            onClick={sendTest}
            disabled={testing || devices.length === 0}
            className="mt-7 inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full bg-ink text-[17px] font-semibold tracking-[-0.01em] text-onink active:scale-[0.98] disabled:opacity-40"
            style={{ transitionProperty: "transform, opacity", transitionDuration: "120ms" }}
            data-testid="notification-send-test"
          >
            {testing ? <Spinner size={20} stroke={2.4} /> : <BellRing className="h-[20px] w-[20px]" strokeWidth={2.1} />}
            Send a test notification
          </button>
        </>
      )}
    </div>
  );
}
