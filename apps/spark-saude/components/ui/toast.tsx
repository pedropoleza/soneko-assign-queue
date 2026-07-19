"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "error";
interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
}

const ToastContext = React.createContext<{ toast: (t: { title: string; description?: string; tone?: Tone }) => void }>({
  toast: () => {},
});

export function useToast() {
  return React.useContext(ToastContext);
}

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback((t: { title: string; description?: string; tone?: Tone }) => {
    const id = ++counter;
    setItems((cur) => [...cur, { id, title: t.title, description: t.description, tone: t.tone ?? "default" }]);
    setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {items.map((item) => {
          const Icon = item.tone === "success" ? CheckCircle2 : item.tone === "error" ? AlertCircle : Info;
          return (
            <div
              key={item.id}
              className={cn(
                "pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-background px-4 py-3 shadow-card-hover",
                item.tone === "error" && "border-status-red-bg",
                item.tone === "success" && "border-status-green-bg",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  item.tone === "success" && "text-status-green-fg",
                  item.tone === "error" && "text-status-red-fg",
                  item.tone === "default" && "text-status-blue-fg",
                )}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                {item.description ? <p className="text-xs text-muted-foreground">{item.description}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
