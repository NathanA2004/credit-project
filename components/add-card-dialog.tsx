"use client";

import { useState, type ComponentProps, type FormEvent } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RankableCard } from "@/lib/engine/calculator";
import { cn } from "@/lib/utils";

type AddCardDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onAdd: (card: RankableCard) => void;
  showTrigger?: boolean;
};

const emptyForm = {
  institutionName: "",
  cardName: "",
  lastFourDigits: "",
  creditLimit: "",
  currentBalance: "0",
  apr: "",
  statementClosingDay: "",
  paymentDueDay: "",
  gracePeriodDays: "25",
  defaultCashback: "1",
  groceriesCashback: "",
  diningCashback: "",
  travelCashback: "",
};

function parsePercent(value: string, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || value.trim() === "") return fallback;
  return Math.max(parsed, 0) / 100;
}

function parseDay(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) return null;
  return parsed;
}

export function AddCardDialog({
  open,
  onOpenChange,
  onAdd,
  showTrigger = true,
}: AddCardDialogProps) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  function update(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setForm(emptyForm);
      setError(null);
    }
    onOpenChange?.(nextOpen);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const lastFour = form.lastFourDigits.replace(/\D/g, "").slice(0, 4);
    const creditLimit = Number(form.creditLimit);
    const currentBalance = Number(form.currentBalance);
    const apr = Number(form.apr);
    const statementClosingDay = parseDay(form.statementClosingDay);
    const paymentDueDay = parseDay(form.paymentDueDay);
    const gracePeriodDays = Number(form.gracePeriodDays || "25");

    if (form.institutionName.trim().length < 2 || form.cardName.trim().length < 2) {
      setError("Institution and card name are required.");
      return;
    }
    if (lastFour.length !== 4) {
      setError("Enter the last four digits only.");
      return;
    }
    if (!Number.isFinite(creditLimit) || creditLimit <= 0) {
      setError("Credit limit must be greater than zero.");
      return;
    }
    if (!Number.isFinite(currentBalance) || currentBalance < 0) {
      setError("Current balance cannot be negative.");
      return;
    }
    if (!Number.isFinite(apr) || apr < 0) {
      setError("APR must be zero or greater.");
      return;
    }
    if (statementClosingDay === null || paymentDueDay === null) {
      setError("Closing and due days must be whole numbers from 1 to 31.");
      return;
    }
    if (!Number.isFinite(gracePeriodDays) || gracePeriodDays < 0) {
      setError("Grace period must be zero or greater.");
      return;
    }

    const defaultRate = parsePercent(form.defaultCashback, 0.01);
    const card: RankableCard = {
      id: `custom-${crypto.randomUUID()}`,
      institutionName: form.institutionName.trim(),
      cardName: form.cardName.trim(),
      lastFourDigits: lastFour,
      creditLimit,
      currentBalance,
      apr,
      statementClosingDay,
      paymentDueDay,
      gracePeriodDays,
      cashbackCategory: {
        default: defaultRate,
        groceries: parsePercent(form.groceriesCashback, defaultRate),
        dining: parsePercent(form.diningCashback, defaultRate),
        travel: parsePercent(form.travelCashback, defaultRate),
      },
    };

    onAdd(card);
    setForm(emptyForm);
    setError(null);
    onOpenChange?.(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button type="button">
            <Plus />
            Add custom card
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add custom card</DialogTitle>
            <DialogDescription>
              Only the last four digits are stored. The new card appears on the dashboard, calendar, and
              purchase advisor immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              id="institutionName"
              label="Institution"
              onChange={(value) => update("institutionName", value)}
              placeholder="Chase"
              required
              value={form.institutionName}
            />
            <Field
              id="cardName"
              label="Card name"
              onChange={(value) => update("cardName", value)}
              placeholder="Freedom Unlimited"
              required
              value={form.cardName}
            />
            <Field
              id="lastFourDigits"
              inputMode="numeric"
              label="Last four digits"
              maxLength={4}
              onChange={(value) => update("lastFourDigits", value.replace(/\D/g, "").slice(0, 4))}
              pattern="\d{4}"
              placeholder="1234"
              required
              value={form.lastFourDigits}
            />
            <Field
              id="apr"
              label="APR (%)"
              min="0"
              onChange={(value) => update("apr", value)}
              placeholder="21.99"
              required
              step="0.01"
              type="number"
              value={form.apr}
            />
            <Field
              id="creditLimit"
              label="Credit limit"
              min="1"
              onChange={(value) => update("creditLimit", value)}
              placeholder="10000"
              required
              step="0.01"
              type="number"
              value={form.creditLimit}
            />
            <Field
              id="currentBalance"
              label="Current balance"
              min="0"
              onChange={(value) => update("currentBalance", value)}
              placeholder="0"
              required
              step="0.01"
              type="number"
              value={form.currentBalance}
            />
            <Field
              id="statementClosingDay"
              label="Statement closing day"
              max="31"
              min="1"
              onChange={(value) => update("statementClosingDay", value)}
              placeholder="15"
              required
              type="number"
              value={form.statementClosingDay}
            />
            <Field
              id="paymentDueDay"
              label="Payment due day"
              max="31"
              min="1"
              onChange={(value) => update("paymentDueDay", value)}
              placeholder="10"
              required
              type="number"
              value={form.paymentDueDay}
            />
            <Field
              id="gracePeriodDays"
              label="Grace period (days)"
              min="0"
              onChange={(value) => update("gracePeriodDays", value)}
              type="number"
              value={form.gracePeriodDays}
            />
            <Field
              id="defaultCashback"
              label="Default cash back (%)"
              min="0"
              onChange={(value) => update("defaultCashback", value)}
              placeholder="1"
              step="0.1"
              type="number"
              value={form.defaultCashback}
            />
            <Field
              id="groceriesCashback"
              label="Groceries cash back (%)"
              min="0"
              onChange={(value) => update("groceriesCashback", value)}
              placeholder="Same as default"
              step="0.1"
              type="number"
              value={form.groceriesCashback}
            />
            <Field
              id="diningCashback"
              label="Dining cash back (%)"
              min="0"
              onChange={(value) => update("diningCashback", value)}
              placeholder="Same as default"
              step="0.1"
              type="number"
              value={form.diningCashback}
            />
            <Field
              id="travelCashback"
              className="sm:col-span-2"
              label="Travel cash back (%)"
              min="0"
              onChange={(value) => update("travelCashback", value)}
              placeholder="Same as default"
              step="0.1"
              type="number"
              value={form.travelCashback}
            />
          </div>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          <DialogFooter className="mt-6">
            <Button type="submit">Save card</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  className,
  onChange,
  ...props
}: {
  id: string;
  label: string;
  className?: string;
  onChange: (value: string) => void;
} & Omit<ComponentProps<typeof Input>, "id" | "onChange">) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} onChange={(event) => onChange(event.target.value)} {...props} />
    </div>
  );
}
