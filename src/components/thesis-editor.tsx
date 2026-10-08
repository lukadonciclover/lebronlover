"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { NativeSelect } from "@/components/ui/native-select";
import { saveThesisAction } from "@/app/actions";
import { impliedUpside } from "@/lib/finance/calculations";
import { asPercent, formatCurrencyValue, formatMetric } from "@/lib/format";
import { RECOMMENDATIONS, THESIS_SUMMARY_MAX, type Recommendation } from "@/lib/constants";

export type ThesisEditorInitial = {
  recommendation: Recommendation | null;
  targetPrice: string;
  summary: string;
  catalysts: string[];
  risks: string[];
};

export function ThesisEditor({
  analysisId,
  initial,
  currentPrice,
  quoteCurrency,
}: {
  analysisId: string;
  initial: ThesisEditorInitial;
  currentPrice: number | null;
  quoteCurrency: string;
}) {
  const router = useRouter();
  const [recommendation, setRecommendation] = useState<string>(initial.recommendation ?? "");
  const [targetPrice, setTargetPrice] = useState(initial.targetPrice);
  const [summary, setSummary] = useState(initial.summary);
  const [catalysts, setCatalysts] = useState<string[]>(initial.catalysts.length ? initial.catalysts : [""]);
  const [risks, setRisks] = useState<string[]>(initial.risks.length ? initial.risks : [""]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const target = targetPrice.trim() === "" ? null : Number(targetPrice);
  const upside = useMemo(
    () => impliedUpside(Number.isFinite(target as number) ? (target as number) : null, currentPrice),
    [target, currentPrice],
  );

  function updateList(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string,
  ) {
    setter((items) => items.map((item, position) => (position === index ? value : item)));
  }

  function removeListItem(setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) {
    setter((items) => (items.length <= 1 ? [""] : items.filter((_, position) => position !== index)));
  }

  async function persist(redirect: boolean) {
    setMessage(null);
    if (target !== null && (!Number.isFinite(target) || target < 0)) {
      setMessage("Target price must be a non-negative number.");
      toast.error("Target price must be a non-negative number.");
      return;
    }
    setSaving(true);
    try {
      const result = await saveThesisAction({
        id: analysisId,
        thesis: {
          recommendation: recommendation === "" ? null : recommendation,
          targetPrice,
          summary,
          catalysts,
          risks,
        },
      });
      if (!result.ok) {
        setMessage(result.message);
        toast.error(result.message);
        return;
      }
      toast.success("Thesis saved.");
      if (redirect) {
        router.push(`/analysis/${analysisId}`);
      }
      router.refresh();
    } catch {
      setMessage("Unexpected error while saving. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const summaryRemaining = THESIS_SUMMARY_MAX - summary.length;

  return (
    <div className="space-y-6">
      {message ? (
        <Alert variant="destructive">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="recommendation">Rating</Label>
          <NativeSelect
            id="recommendation"
            value={recommendation}
            onChange={(event) => setRecommendation(event.target.value)}
          >
            <option value="">Not rated</option>
            {RECOMMENDATIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            No recommendation is assigned unless you choose one.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="targetPrice">Target price ({quoteCurrency})</Label>
          <Input
            id="targetPrice"
            inputMode="decimal"
            value={targetPrice}
            onChange={(event) => setTargetPrice(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Current price</Label>
          <p className="flex h-8 items-center rounded-lg border border-dashed px-2.5 text-sm tabular-nums">
            {currentPrice === null ? "N/A" : formatCurrencyValue(currentPrice, quoteCurrency)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <span className="text-muted-foreground">Implied upside/downside preview: </span>
        <span className="font-semibold tabular-nums">{formatMetric(upside, asPercent)}</span>
        {currentPrice === null ? (
          <span className="ml-2 text-xs text-muted-foreground">
            Add a share price to calculate the implied return.
          </span>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="summary">Core thesis summary</Label>
          <span className={summaryRemaining < 0 ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {summary.length}/{THESIS_SUMMARY_MAX}
          </span>
        </div>
        <Textarea
          id="summary"
          rows={6}
          value={summary}
          maxLength={THESIS_SUMMARY_MAX}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="Why is this an attractive (or unattractive) investment? What does the market misunderstand?"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <DynamicList
          label="Catalysts"
          description="Events or drivers that could move the stock."
          items={catalysts}
          onChange={(index, value) => updateList(setCatalysts, index, value)}
          onAdd={() => setCatalysts((items) => [...items, ""])}
          onRemove={(index) => removeListItem(setCatalysts, index)}
        />
        <DynamicList
          label="Risks"
          description="What could go wrong with the thesis?"
          items={risks}
          onChange={(index, value) => updateList(setRisks, index, value)}
          onAdd={() => setRisks((items) => [...items, ""])}
          onRemove={(index) => removeListItem(setRisks, index)}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => persist(false)} disabled={saving}>
          {saving ? "Saving…" : "Save thesis"}
        </Button>
        <Button type="button" variant="outline" onClick={() => persist(true)} disabled={saving}>
          {saving ? "Saving…" : "Save & view analysis"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Saving a thesis does not change any financial data. Empty items are trimmed and excluded.
      </p>
    </div>
  );
}

function DynamicList({
  label,
  description,
  items,
  onChange,
  onAdd,
  onRemove,
}: {
  label: string;
  description: string;
  items: string[];
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label>{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="size-4" aria-hidden />
          Add
        </Button>
      </div>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2">
            <Input
              aria-label={`${label} item ${index + 1}`}
              value={item}
              onChange={(event) => onChange(index, event.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${label} item ${index + 1}`}
              onClick={() => onRemove(index)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}