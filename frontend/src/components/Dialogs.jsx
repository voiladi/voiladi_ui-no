import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";

export const ConfirmDialog = ({ open, onOpenChange, title, description, confirmText = "Confirm", danger = false, onConfirm, loading, testId = "confirm-dialog" }) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="w-[calc(100%-32px)] max-w-[360px] rounded-[26px] border-line bg-white p-6" data-testid={testId}>
      <AlertDialogTitle className="vo-h2">{title}</AlertDialogTitle>
      <AlertDialogDescription className="text-[15px] leading-relaxed text-mute">{description}</AlertDialogDescription>
      <div className="mt-4 flex flex-col gap-2">
        <button type="button" className={`${danger ? "vo-btn-danger" : "vo-btn-primary"} w-full`} onClick={onConfirm} disabled={loading} data-testid={`${testId}-confirm`}>
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
      <AlertDialogContent className="w-[calc(100%-32px)] max-w-[380px] rounded-[26px] border-line bg-white p-6" data-testid="report-dialog">
        <AlertDialogTitle className="vo-h2">Report {name || "this profile"}</AlertDialogTitle>
        <AlertDialogDescription className="text-[14px] text-mute">Tell us what's going on. Reports are private.</AlertDialogDescription>
        <div className="mt-3 space-y-2">
          {reasons.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`vo-option py-3 text-[15px] ${reason === r ? "vo-option-on" : ""}`}
              data-testid="report-reason-option"
            >
              {r}
              <span className={`h-5 w-5 rounded-full border-2 ${reason === r ? "border-brand bg-brand" : "border-line"}`} />
            </button>
          ))}
          <textarea
            className="vo-textarea mt-2 min-h-[72px] text-[15px]"
            placeholder="Anything else? (optional)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            data-testid="report-details-input"
          />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" className="vo-btn-danger w-full" disabled={!reason || loading} onClick={() => onSubmit(reason, details)} data-testid="report-submit-button">
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
