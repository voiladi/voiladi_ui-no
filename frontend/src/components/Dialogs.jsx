import React, { useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Check } from "lucide-react";

const PANEL = "w-[calc(100%-40px)] max-w-[340px] rounded-[24px] border-0 bg-bg p-6 shadow-modal";

export const ConfirmDialog = ({ open, onOpenChange, title, description, confirmText = "Confirm", danger = false, onConfirm, loading, testId = "confirm-dialog" }) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className={PANEL} data-testid={testId}>
      <AlertDialogTitle className="text-center text-[20px] font-bold leading-tight tracking-[-0.01em] text-ink">{title}</AlertDialogTitle>
      <AlertDialogDescription className="text-center text-[14px] leading-relaxed text-mute">{description}</AlertDialogDescription>
      <div className="mt-4 flex flex-col gap-2">
        <button type="button" className={`${danger ? "vo-btn bg-red text-white" : "vo-btn-primary"} w-full`} onClick={onConfirm} disabled={loading} aria-busy={loading} data-testid={`${testId}-confirm`}>
          {loading ? "Working..." : confirmText}
        </button>
        <button type="button" className="vo-btn-ghost w-full" onClick={() => onOpenChange(false)} data-testid={`${testId}-cancel`}>
          Cancel
        </button>
      </div>
    </AlertDialogContent>
  </AlertDialog>
);

export const ReportDialog = ({ open, onOpenChange, reasons = [], onSubmit, loading, name }) => {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setReason("");
          setDetails("");
        }
        onOpenChange(o);
      }}
    >
      <AlertDialogContent className={`${PANEL} max-w-[380px]`} data-testid="report-dialog">
        <AlertDialogTitle className="text-[20px] font-bold leading-tight tracking-[-0.01em] text-ink">Report {name || "this profile"}</AlertDialogTitle>
        <AlertDialogDescription className="text-[14px] text-mute">Tell us what's going on. Reports are private.</AlertDialogDescription>
        <div className="mt-2 overflow-hidden rounded-[16px] bg-surface">
          {reasons.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className="vo-row" data-testid="report-reason-option" aria-pressed={reason === r}>
              <span className="flex-1">{r}</span>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${reason === r ? "border-ink bg-ink text-onink" : "border-mute"}`}>
                {reason === r && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
            </button>
          ))}
        </div>
        <textarea className="vo-textarea mt-3 min-h-[72px] text-[15px]" placeholder="Anything else? (optional)" value={details} onChange={(e) => setDetails(e.target.value)} data-testid="report-details-input" />
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" className="vo-btn bg-red text-white w-full" disabled={!reason || loading} aria-busy={loading} onClick={() => onSubmit(reason, details)} data-testid="report-submit-button">
            {loading ? "Sending..." : "Send report"}
          </button>
          <button type="button" className="vo-btn-ghost w-full" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};
