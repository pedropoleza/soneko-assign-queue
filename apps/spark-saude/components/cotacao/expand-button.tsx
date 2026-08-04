"use client";

import * as React from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Escape hatch from the GHL iframe.
 *
 * The Custom Menu Link frame has a height GHL decides, and we can't resize it
 * from inside (cross-origin). So when the broker needs room — comparing a row
 * of plans, reading the cost-sharing table — she takes the app full screen.
 *
 * Fullscreen only works if the parent frame carries `allow="fullscreen"`, which
 * we don't control either. When it doesn't, we fall back to opening the same
 * app in its own tab, which always works.
 */
export function ExpandButton() {
  const [isFull, setIsFull] = React.useState(false);

  React.useEffect(() => {
    const onChange = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    try {
      if (!document.fullscreenEnabled) throw new Error("fullscreen bloqueado no iframe");
      await document.documentElement.requestFullscreen();
    } catch {
      window.open(window.location.href, "_blank", "noopener");
    }
  };

  return (
    <Button
      variant="outline"
      onClick={toggle}
      className="h-10"
      title={isFull ? "Sair da tela cheia" : "Abrir em tela cheia — mais espaço para comparar os planos"}
    >
      {isFull ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      {isFull ? "Reduzir" : "Ampliar"}
    </Button>
  );
}
