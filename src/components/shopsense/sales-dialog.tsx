"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MagneticSave } from "./magnetic";
import type { Lang } from "@/lib/domain/types";
import { t } from "./i18n";
import { post } from "./use-dashboard";

export function SalesDialog({
  open,
  onOpenChange,
  lang,
  currency,
  initial,
  visitors,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lang: Lang;
  currency: string;
  initial?: { salesTotal: number; buyerCount: number } | null;
  visitors: number;
  onSaved: () => void;
}) {
  const c = t(lang);
  const [sales, setSales] = useState("");
  const [receipts, setReceipts] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSales(initial ? String(initial.salesTotal) : "");
      setReceipts(initial ? String(initial.buyerCount) : "");
      setErr(null);
    }
  }, [open, initial]);

  const s = Number(sales);
  const r = Number(receipts);
  const valid = sales !== "" && s >= 0 && (receipts === "" || (Number.isInteger(r) && r >= 0));
  const preview = valid && receipts !== "" && visitors > 0 ? Math.min(100, Math.round((r / visitors) * 100)) : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) {
      setErr(lang === "ms" ? "Masukkan jumlah jualan." : "Enter today's sales.");
      return;
    }
    setSaving(true);
    try {
      await post("/api/sales", receipts === "" ? { salesTotal: s } : { salesTotal: s, buyerCount: r });
      toast.success(c.saved);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{c.salesTitle}</DialogTitle>
          <DialogDescription>{c.salesBody}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="mt-2 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sales">{c.salesTotal}</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currency}</span>
              <Input id="sales" inputMode="decimal" autoFocus className="pl-11 text-lg tabular-nums" value={sales} onChange={(e) => setSales(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="1,250" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="receipts">{c.receipts}</Label>
            <Input id="receipts" inputMode="numeric" className="text-lg tabular-nums" value={receipts} onChange={(e) => setReceipts(e.target.value.replace(/[^0-9]/g, ""))} placeholder="74" />
            <p className="text-[11px] text-muted-foreground">
              {lang === "ms" ? "Tak pasti? Biarkan kosong — kami anggarkan dari purata bakul anda." : "Not sure? Leave it blank and we'll estimate it from your usual basket."}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {err ? <span className="text-[var(--red-11)]">{err}</span> : preview !== null ? (
                lang === "ms" ? <>≈ <b className="text-foreground">{preview}%</b> daripada {visitors} pengunjung membeli</> : <>≈ <b className="text-foreground">{preview}%</b> of {visitors} visitors bought</>
              ) : null}
            </p>
            <MagneticSave disabled={saving}>{c.save}</MagneticSave>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
