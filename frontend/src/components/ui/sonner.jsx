import React from "react";
import { Toaster as Sonner, toast } from "sonner";
import { Check, AlertCircle, Info } from "lucide-react";

/*
 * In-app notifications, Instagram-style:
 *  - confirmations ("Boost started", "Report received"...) = ONE compact dark bar that slides up from the bottom,
 *    sitting just above the tab bar; never stacks; auto-dismisses.
 *  - realtime banners (new match / message) use toast.custom with position "top-center" (see AppShell).
 * Visual styling lives in index.css (.vo-toast).
 */
const Toaster = (props) => (
  <Sonner
    theme="dark"
    position="bottom-center"
    className="toaster group"
    visibleToasts={1}
    expand={false}
    gap={8}
    duration={2400}
    closeButton={false}
    offset={{ bottom: "calc(78px + env(safe-area-inset-bottom))", top: "calc(12px + env(safe-area-inset-top))" }}
    mobileOffset={{ bottom: "calc(78px + env(safe-area-inset-bottom))", top: "calc(12px + env(safe-area-inset-top))", left: 12, right: 12 }}
    icons={{
      success: <Check className="h-[18px] w-[18px]" strokeWidth={2.5} />,
      error: <AlertCircle className="h-[18px] w-[18px]" strokeWidth={2.2} />,
      info: <Info className="h-[18px] w-[18px]" strokeWidth={2.2} />,
      warning: <AlertCircle className="h-[18px] w-[18px]" strokeWidth={2.2} />,
    }}
    toastOptions={{
      unstyled: true,
      classNames: {
        toast: "vo-toast",
        title: "vo-toast-title",
        description: "vo-toast-desc",
        icon: "vo-toast-icon",
        content: "vo-toast-content",
        actionButton: "vo-toast-action",
        cancelButton: "vo-toast-cancel",
      },
    }}
    {...props}
  />
);

export { Toaster, toast };
