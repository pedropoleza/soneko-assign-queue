"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./dialog";
import { Button } from "./button";

/** Confirmation gate for every write action (CLAUDE.md §7: writes are confirmed). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  onConfirm,
  loading = false,
  danger = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-5">
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription className="mt-1.5">{description}</DialogDescription> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant={danger ? "danger" : "default"} size="sm" onClick={onConfirm} disabled={loading}>
            {loading ? "Aplicando…" : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
