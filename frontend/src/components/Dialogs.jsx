import React, { useState } from "react";
import * as AD from "@radix-ui/react-alert-dialog";
import { Check } from "lucide-react";
import { Spinner } from "@/components/Loading";

/*
 * Confirmations, iOS style (UIAlertController .actionSheet):
 *  - slides up from the bottom, frosted-glass group with grey title/message, big red destructive action,
 *    and a separate solid "Cancel" pill underneath. Apple text stack. Works in light and dark mode.
 *  - ReportDialog is the same sheet with a reason list; on success it shows an inline
 *    "Thanks for letting us know" state instead of a popup.
 */

const Sheet = ({ open, onOpenChange, children, testId }) => (
  <AD.Root open={open} onOpenChange={onOpenChange}>
    <AD.Portal>
      <AD.Overlay className="vo-sheet-overlay" />
      <AD.Content className="vo-sheet vo-apple" data-testid={testId} onOpenAutoFocus={(e) => e.preventDefault()}>
        {children}
      </AD.Content>
    </AD.Portal>
  </AD.Root>
);

export const ConfirmDialog = ({ open, onOpenChange, title, description, confirmText = "Confirm", danger = false, ink = false, onConfirm, loading, testId = "confirm-dialog" }) => (
  <Sheet open={open} onOpenChange={onOpenChange} testId={testId}>
    <div className="vo-sheet-group">
      <div className="vo-sheet-head">
        <AD.Title className="vo-sheet-title">{title}</AD.Title>
        {description && <AD.Description className="vo-sheet-desc">{description}</AD.Description>}
      </div>
      <button type="button" className={`vo-sheet-action ${danger ? "vo-sheet-danger" : ink ? "vo-sheet-ink" : ""}`} onClick={onConfirm} disabled={loading} aria-busy={loading} data-testid={`${testId}-confirm`}>
        {loading ? <Spinner size={22} stroke={2} /> : confirmText}
      </button>
    </div>
    <button type="button" className="vo-sheet-cancel" onClick={() => onOpenChange(false)} disabled={loading} data-testid={`${testId}-cancel`}>
      Cancel
    </button>
  </Sheet>
);

export const ReportDialog = ({ open, onOpenChange, reasons = [], onSubmit, loading, name }) => {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);

  const close = (o) => {
    if (!o) {
      setReason("");
      setDetails("");
      setDone(false);
    }
    onOpenChange(o);
  };

  const submit = async () => {
    const ok = await onSubmit(reason, details);
    if (ok !== false) setDone(true);
  };

  return (
    <Sheet open={open} onOpenChange={close} testId="report-dialog">
      {done ? (
        <>
          <div className="vo-sheet-group">
            <div className="vo-sheet-head py-7" data-testid="report-done">
              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-onink">
                <Check className="h-6 w-6" strokeWidth={2.5} />
              </span>
              <AD.Title className="vo-sheet-title text-[17px] text-ink">Thanks for letting us know</AD.Title>
              <AD.Description className="vo-sheet-desc">Your report is private. We'll review it and take action if it breaks our guidelines.</AD.Description>
            </div>
          </div>
          <button type="button" className="vo-sheet-cancel" onClick={() => close(false)} data-testid="report-done-button">
            Done
          </button>
        </>
      ) : (
        <>
          <div className="vo-sheet-group">
            <div className="vo-sheet-head">
              <AD.Title className="vo-sheet-title">Report {name || "this profile"}</AD.Title>
              <AD.Description className="vo-sheet-desc">Why are you reporting this? Reports are private.</AD.Description>
            </div>
            <div className="vo-sheet-list" role="radiogroup">
              {reasons.map((r) => (
                <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => setReason(r)} className="vo-sheet-option" data-testid="report-reason-option">
                  <span className="flex-1 truncate">{r}</span>
                  {reason === r && <Check className="h-[18px] w-[18px] shrink-0" strokeWidth={2.5} />}
                </button>
              ))}
            </div>
            <div className="px-3 pb-3 pt-2">
              <textarea className="vo-sheet-textarea" placeholder="Anything else? (optional)" value={details} onChange={(e) => setDetails(e.target.value)} data-testid="report-details-input" />
            </div>
            <button type="button" className="vo-sheet-action vo-sheet-danger" disabled={!reason || loading} aria-busy={loading} onClick={submit} data-testid="report-submit-button">
              {loading ? <Spinner size={22} stroke={2} /> : "Submit report"}
            </button>
          </div>
          <button type="button" className="vo-sheet-cancel" onClick={() => close(false)} disabled={loading}>
            Cancel
          </button>
        </>
      )}
    </Sheet>
  );
};
