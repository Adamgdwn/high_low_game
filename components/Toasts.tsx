import { cn } from "@/lib/utils";

export interface ToastItem {
  id: string;
  kind: "info" | "success" | "error" | "warning";
  message: string;
}

export function Toasts({ items }: { items: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {items.map((toast) => (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className={cn(
            "toast-in rounded-xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur",
            toast.kind === "success" && "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
            toast.kind === "error" && "border-rose-300/25 bg-rose-400/10 text-rose-100",
            toast.kind === "warning" && "border-amber-300/25 bg-amber-400/10 text-amber-100",
            toast.kind === "info" && "border-cyan-300/25 bg-cyan-400/10 text-cyan-100"
          )}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
