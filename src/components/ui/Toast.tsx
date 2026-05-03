"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastVariant = "info" | "error" | "success";
type Toast = { id: number; variant: ToastVariant; message: string };

type ToastApi = {
  toast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const TIMEOUT_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, variant, message }]);
  }, []);

  // Auto-dismiss each toast after TIMEOUT_MS.
  useEffect(() => {
    if (toasts.length === 0) return;
    const oldest = toasts[0];
    const t = window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== oldest.id));
    }, TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.variant === "error" ? "alert" : "status"}
            className={`pointer-events-auto w-full max-w-md rounded-xl px-4 py-3 text-sm shadow-lg ring-1 ${
              t.variant === "error"
                ? "bg-red-600 text-white ring-red-700/30"
                : t.variant === "success"
                  ? "bg-brand text-white ring-brand-dark/40"
                  : "bg-slate-900 text-white ring-slate-700/40"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
