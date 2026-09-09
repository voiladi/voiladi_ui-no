import { Toaster as Sonner, toast } from "sonner"

/* iOS-style banner toasts. Visual styling lives in index.css ([data-sonner-toast]). */
const Toaster = ({
  ...props
}) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast",
          description: "group-[.toast]:text-mute",
          actionButton: "group-[.toast]:bg-ink group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-surface2 group-[.toast]:text-mute",
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }
