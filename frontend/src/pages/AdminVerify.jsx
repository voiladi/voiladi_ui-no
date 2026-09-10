import React, { useEffect, useState } from "react";
import { Check, X, ShieldCheck, RefreshCw, LogOut } from "lucide-react";
import { Spinner } from "@/components/Loading";
import { SoftCard, SoftPill } from "@/components/SoftUI";
import { GlassSegmented } from "@/components/GlassSegmented";
import { UserPhoto } from "@/components/UserPhoto";
import { notice } from "@/lib/feedback";
import { api, errMsg } from "@/lib/api";
import { timeAgo } from "@/lib/format";

/*
 * Operator screen: review selfies. Protected by the admin key (x-admin-key), kept in sessionStorage only.
 * Left: the selfie. Right: the person's profile photos. Approve -> black tick. Reject -> optional note shown to the user.
 */
const KEY = "voiladi_admin_key";
const TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function AdminVerify() {
  const [key, setKey] = useState(() => sessionStorage.getItem(KEY) || "");
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState("pending");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});

  const load = async (k = key, t = tab) => {
    if (!k) return;
    setLoading(true);
    try {
      const { data: d } = await api.get("/admin/verifications", { params: { status: t }, headers: { "x-admin-key": k } });
      setData(d);
    } catch (e) {
      if (e?.response?.status === 401) {
        sessionStorage.removeItem(KEY);
        setKey("");
        notice("That admin key isn't right");
      } else notice(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(key, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tab]);

  const review = async (row, approve) => {
    setBusy(row.user_id);
    try {
      await api.post(`/admin/verifications/${row.user_id}/${approve ? "approve" : "reject"}`, { note: notes[row.user_id] || "" }, { headers: { "x-admin-key": key } });
      await load();
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  if (!key) {
    return (
      <div className="vo-neu-page flex min-h-full flex-col items-center justify-center px-6" data-testid="admin-verify-login">
        <span className="vo-soft inline-flex h-16 w-16 items-center justify-center rounded-full text-ink">
          <ShieldCheck className="h-8 w-8" strokeWidth={1.8} />
        </span>
        <h1 className="mt-5 text-[24px] font-bold tracking-[-0.02em] text-ink">Verification review</h1>
        <p className="mt-1 text-center text-[15px] text-mute">Enter the admin key to review selfies.</p>
        <form
          className="mt-6 w-full max-w-[340px]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            sessionStorage.setItem(KEY, draft.trim());
            setKey(draft.trim());
          }}
        >
          <input type="password" className="vo-input bg-bg" placeholder="Admin key" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus data-testid="admin-key-input" />
          <button type="submit" className="mt-4 h-[50px] w-full rounded-full bg-ink text-[17px] font-semibold text-onink disabled:opacity-40" disabled={!draft.trim()} data-testid="admin-key-submit">
            Continue
          </button>
        </form>
      </div>
    );
  }

  const items = data?.items || [];
  return (
    <div className="vo-neu-page flex min-h-full flex-col px-5 pb-10" data-testid="admin-verify-page">
      <div className="flex items-center justify-between pt-4">
        <h1 className="text-[clamp(26px,8cqi,32px)] font-bold tracking-[-0.025em] text-ink">Verification</h1>
        <div className="flex gap-2">
          <SoftPill className="h-[40px] px-3" onClick={() => load()} aria-label="Refresh" testId="admin-refresh-button">
            <RefreshCw className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </SoftPill>
          <SoftPill
            className="h-[40px] px-3"
            onClick={() => {
              sessionStorage.removeItem(KEY);
              setKey("");
            }}
            aria-label="Sign out"
            testId="admin-signout-button"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </SoftPill>
        </div>
      </div>
      <p className="mt-1 text-[15px] text-mute" data-testid="admin-counts">
        {data ? `${data.counts.pending} pending · ${data.counts.approved} approved · ${data.counts.rejected} rejected` : "Loading..."}
      </p>
      <GlassSegmented options={TABS} value={tab} onChange={setTab} testIdPrefix="admin-tab" className="mt-4" />

      <div className="mt-4 flex flex-col gap-4">
        {loading && !data ? (
          <div className="flex justify-center py-16">
            <Spinner size={28} stroke={2.5} />
          </div>
        ) : items.length === 0 ? (
          <SoftCard className="px-5 py-10 text-center" testId="admin-empty">
            <p className="text-[18px] font-bold text-ink">Nothing {tab} right now</p>
            <p className="mt-1 text-[15px] text-mute">New selfies will show up here.</p>
          </SoftCard>
        ) : (
          items.map((row) => (
            <SoftCard key={row.user_id} className="p-4" testId="admin-verify-row">
              <div className="flex items-center gap-3">
                <UserPhoto src={row.photos?.[0]} name={row.name} className="h-12 w-12 rounded-full text-base" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-bold text-ink">
                    {row.name}
                    {row.age ? `, ${row.age}` : ""}
                  </p>
                  <p className="truncate text-[13px] text-mute">
                    @{row.username || "-"} · sent {timeAgo(row.submitted_at)}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <figure className="m-0">
                  <div className="aspect-[3/4] overflow-hidden rounded-[18px] bg-surface2">{row.selfie_url && <img src={row.selfie_url} alt="Selfie" className="h-full w-full object-cover" />}</div>
                  <figcaption className="mt-1.5 text-center text-[12px] font-semibold uppercase tracking-[0.1em] text-mute">Selfie</figcaption>
                </figure>
                <figure className="m-0">
                  <div className="aspect-[3/4] overflow-hidden rounded-[18px] bg-surface2">{row.photos?.[0] && <img src={row.photos[0]} alt="Profile" className="h-full w-full object-cover" />}</div>
                  <figcaption className="mt-1.5 text-center text-[12px] font-semibold uppercase tracking-[0.1em] text-mute">Profile photo</figcaption>
                </figure>
              </div>
              {row.status === "pending" ? (
                <>
                  <input className="vo-input mt-3 bg-bg text-[14px]" placeholder="Note to the user if rejecting (optional)" value={notes[row.user_id] || ""} onChange={(e) => setNotes((n) => ({ ...n, [row.user_id]: e.target.value }))} data-testid="admin-note-input" />
                  <div className="mt-3 flex gap-3">
                    <SoftPill className="h-[48px] flex-1 text-red" onClick={() => review(row, false)} disabled={busy === row.user_id} testId="admin-reject-button">
                      <X className="h-5 w-5" strokeWidth={2.5} /> Reject
                    </SoftPill>
                    <button type="button" onClick={() => review(row, true)} disabled={busy === row.user_id} className="inline-flex h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-ink text-[17px] font-semibold text-onink disabled:opacity-50" data-testid="admin-approve-button">
                      {busy === row.user_id ? <Spinner size={18} stroke={2.5} /> : <Check className="h-5 w-5" strokeWidth={2.6} />} Approve
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-[13px] text-mute">
                  {row.status === "approved" ? "Approved" : "Rejected"} {timeAgo(row.reviewed_at)}
                  {row.note ? ` · "${row.note}"` : ""}
                </p>
              )}
            </SoftCard>
          ))
        )}
      </div>
    </div>
  );
}
