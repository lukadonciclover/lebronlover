"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { saveNewAnalysisAction, updateAnalysisAction } from "@/app/actions";
import {
  ALL_YEAR_FIELDS,
  CORE_YEAR_FIELDS,
  MARKET_FIELDS,
  OPTIONAL_YEAR_GROUPS,
  VALUATION_FIELDS,
  YEAR_METADATA_KEYS,
  type FieldDef,
} from "@/lib/form-fields";
import { CURRENCIES } from "@/lib/constants";
import type { ProviderWarning } from "@/lib/finance/types";
import type { FieldMeta } from "@/lib/finance/types";
import { formatDateTime } from "@/lib/format";

export type YearState = {
  fiscalYear: string;
  periodStart?: string;
  periodEnd?: string;
  filingDate?: string;
  source?: string | null;
  sourceUrl?: string | null;
  retrievalDate?: string | null;
  originalCurrency?: string | null;
  originalUnits?: string | null;
  manual?: boolean;
  fieldMeta?: FieldMeta;
  [field: string]: string | boolean | FieldMeta | null | undefined;
};

export type FinancialsFormCore = Record<string, string>;

export type FinancialsFormValue = {
  core: FinancialsFormCore;
  years: YearState[];
  meta?: {
    source?: string | null;
    sourceUrl?: string | null;
    retrievalDate?: string | null;
    isDemo?: boolean;
    warnings?: ProviderWarning[];
  };
};

type Props = {
  mode: "manual" | "import" | "edit";
  analysisId?: string;
  initial: FinancialsFormValue;
  cancelHref: string;
  submitLabel?: string;
};

function coreFieldsFor(initial: FinancialsFormCore): Record<string, string> {
  return {
    companyName: initial.companyName ?? "",
    ticker: initial.ticker ?? "",
    industry: initial.industry ?? "",
    sector: initial.sector ?? "",
    exchange: initial.exchange ?? "",
    country: initial.country ?? "",
    securityType: initial.securityType ?? "",
    description: initial.description ?? "",
    reportingCurrency: initial.reportingCurrency || "USD",
    quoteCurrency: initial.quoteCurrency ?? "",
    sharePrice: initial.sharePrice ?? "",
    quoteDate: initial.quoteDate ?? "",
    sharesOutstanding: initial.sharesOutstanding ?? "",
    sharesOutstandingDate: initial.sharesOutstandingDate ?? "",
    marketCap: initial.marketCap ?? "",
    marketCapDate: initial.marketCapDate ?? "",
    cash: initial.cash ?? "",
    cashDate: initial.cashDate ?? "",
    totalDebt: initial.totalDebt ?? "",
    debtDate: initial.debtDate ?? "",
    fxRateToQuote: initial.fxRateToQuote ?? "",
    source: initial.source ?? "",
    sourceUrl: initial.sourceUrl ?? "",
    retrievalDate: initial.retrievalDate ?? "",
  };
}

function NumberField({
  def,
  value,
  onChange,
  error,
  ariaLabel,
}: {
  def: FieldDef;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  ariaLabel: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={ariaLabel} className="text-xs text-muted-foreground">
        {def.label}
        {def.unit ? <span className="ml-1 opacity-70">({def.unit})</span> : null}
      </Label>
      <Input
        id={ariaLabel}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${ariaLabel}-error` : undefined}
      />
      {error ? (
        <p id={`${ariaLabel}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function YearTable({
  years,
  expanded,
  onChange,
  onRemove,
  errors,
  showMetadata,
}: {
  years: YearState[];
  expanded: boolean;
  onChange: (index: number, key: string, value: string) => void;
  onRemove: (index: number) => void;
  errors: Record<string, string>;
  showMetadata: boolean;
}) {
  const rows: { title: string; fields: FieldDef[] }[] = expanded
    ? OPTIONAL_YEAR_GROUPS
    : [];

  return (
    <div className="overflow-x-auto rounded-lg border" role="region" aria-label="Annual financial statements">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="bg-muted/60">
            <th scope="col" className="sticky left-0 z-10 min-w-[180px] bg-muted/60 px-3 py-2 text-left font-medium">
              Metric
            </th>
            {years.map((year, index) => (
              <th key={index} scope="col" className="min-w-[150px] px-3 py-2 text-left align-top font-medium">
                <div className="flex items-end gap-1">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`fy-${index}`} className="text-xs text-muted-foreground">
                      Fiscal year
                    </Label>
                    <Input
                      id={`fy-${index}`}
                      inputMode="numeric"
                      value={String(year.fiscalYear ?? "")}
                      onChange={(event) => onChange(index, "fiscalYear", event.target.value)}
                      aria-invalid={errors[`years.${index}.fiscalYear`] ? true : undefined}
                      className="h-7"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove fiscal year column ${index + 1}`}
                    disabled={years.length <= 1}
                    onClick={() => onRemove(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {errors[`years.${index}.fiscalYear`] ? (
                  <p className="mt-1 text-xs text-destructive">{errors[`years.${index}.fiscalYear`]}</p>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CORE_YEAR_FIELDS.map((def) => (
            <tr key={def.key} className="border-t">
              <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">
                {def.label}
                {def.unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">({def.unit})</span> : null}
              </th>
              {years.map((year, index) => {
                const error = errors[`years.${index}.${def.key}`];
                const origin = (year.fieldMeta as Record<string, string | undefined> | undefined)?.[def.key];
                const label = `${def.label} FY${year.fiscalYear || index + 1}`;
                return (
                  <td key={index} className="px-3 py-1.5 align-top">
                    <Input
                      aria-label={label}
                      inputMode="decimal"
                      value={String(year[def.key] ?? "")}
                      onChange={(event) => onChange(index, def.key, event.target.value)}
                      aria-invalid={error ? true : undefined}
                      className="h-8"
                    />
                    {origin === "derived" ? (
                      <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-amber-600">derived</span>
                    ) : null}
                    {error ? <p className="mt-0.5 text-xs text-destructive">{error}</p> : null}
                  </td>
                );
              })}
            </tr>
          ))}

          {expanded
            ? rows.map((group) => (
                <FragmentRows
                  key={group.title}
                  title={group.title}
                  fields={group.fields}
                  years={years}
                  onChange={onChange}
                  errors={errors}
                />
              ))
            : null}

          {showMetadata
            ? (
                <>
                  <tr className="border-t bg-muted/30">
                    <th scope="row" className="sticky left-0 z-10 bg-muted/30 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Source
                    </th>
                    {years.map((year, index) => (
                      <td key={index} className="px-3 py-2 text-xs text-muted-foreground">
                        {year.source ?? "—"}
                        {year.manual ? " · entered" : ""}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-muted/30">
                    <th scope="row" className="sticky left-0 z-10 bg-muted/30 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Retrieved
                    </th>
                    {years.map((year, index) => (
                      <td key={index} className="px-3 py-2 text-xs text-muted-foreground">
                        {year.retrievalDate ? formatDateTime(year.retrievalDate) : "—"}
                      </td>
                    ))}
                  </tr>
                </>
              )
            : null}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRows({
  title,
  fields,
  years,
  onChange,
  errors,
}: {
  title: string;
  fields: FieldDef[];
  years: YearState[];
  onChange: (index: number, key: string, value: string) => void;
  errors: Record<string, string>;
}) {
  return (
    <>
      <tr className="border-t bg-muted/40">
        <th
          scope="colgroup"
          colSpan={years.length + 1}
          className="px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {title}
        </th>
      </tr>
      {fields.map((def) => (
        <tr key={def.key} className="border-t">
          <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">
            {def.label}
            {def.unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">({def.unit})</span> : null}
          </th>
          {years.map((year, index) => {
            const error = errors[`years.${index}.${def.key}`];
            return (
              <td key={index} className="px-3 py-1.5 align-top">
                <Input
                  aria-label={`${def.label} FY${year.fiscalYear || index + 1}`}
                  inputMode="decimal"
                  value={String(year[def.key] ?? "")}
                  onChange={(event) => onChange(index, def.key, event.target.value)}
                  aria-invalid={error ? true : undefined}
                  className="h-8"
                />
                {error ? <p className="mt-0.5 text-xs text-destructive">{error}</p> : null}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

export function FinancialsForm({ mode, analysisId, initial, cancelHref, submitLabel }: Props) {
  const router = useRouter();
  const [core, setCore] = useState<FinancialsFormCore>(() => coreFieldsFor(initial.core));
  const [years, setYears] = useState<YearState[]>(() => initial.years);
  const [expanded, setExpanded] = useState(mode === "manual" ? false : true);
  const [step, setStep] = useState<1 | 2>(mode === "manual" ? 1 : 2);
  const [removedYears, setRemovedYears] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const missingCore = useMemo(
    () => CORE_YEAR_FIELDS.filter((def) => String(years[0]?.[def.key] ?? "") === "").length,
    [years],
  );

  const meta = initial.meta;
  const isImport = mode === "import";

  function setCoreField(key: string, value: string) {
    setCore((current) => ({ ...current, [key]: value }));
  }

  function setYearField(index: number, key: string, value: string) {
    setYears((current) =>
      current.map((year, position) => (position === index ? { ...year, [key]: value } : year)),
    );
  }

  function addYear() {
    if (years.length >= 5) return;
    const highest = years.reduce((max, year) => Math.max(max, Number(year.fiscalYear) || 0), 0);
    const nextYear = highest > 0 ? String(highest + 1) : String(new Date().getFullYear());
    const blank: YearState = { fiscalYear: nextYear };
    setYears((current) => [...current, blank]);
  }

  function removeYear(index: number) {
    if (years.length <= 1) return;
    const target = years[index];
    const numeric = Number(target.fiscalYear);
    if (mode === "edit" && Number.isFinite(numeric) && target.retrievalDate) {
      setRemovedYears((current) => (current.includes(numeric) ? current : [...current, numeric]));
    }
    setYears((current) => current.filter((_, position) => position !== index));
  }

  function validateClient(): string | null {
    if (!core.companyName.trim()) return "Company name is required.";
    if (!core.ticker.trim()) return "Ticker is required.";
    if (!core.reportingCurrency.trim()) return "Reporting currency is required.";
    const seen = new Set<string>();
    for (const year of years) {
      const value = String(year.fiscalYear ?? "").trim();
      if (!value) return "Every fiscal year needs a value.";
      if (seen.has(value)) return `Fiscal year ${value} is duplicated.`;
      seen.add(value);
    }
    return null;
  }

  function buildYearPayload() {
    return years.map((year) => {
      const clean: Record<string, unknown> = { fiscalYear: year.fiscalYear };
      for (const def of ALL_YEAR_FIELDS) {
        const value = year[def.key];
        clean[def.key] = value === undefined ? "" : value;
      }
      if (year.periodStart) clean.periodStart = year.periodStart;
      if (year.periodEnd) clean.periodEnd = year.periodEnd;
      if (year.filingDate) clean.filingDate = year.filingDate;
      if (year.source) clean.source = year.source;
      if (year.sourceUrl) clean.sourceUrl = year.sourceUrl;
      if (year.retrievalDate) clean.retrievalDate = year.retrievalDate;
      if (year.originalCurrency) clean.originalCurrency = year.originalCurrency;
      if (year.originalUnits) clean.originalUnits = year.originalUnits;
      if (year.manual !== undefined) clean.manual = year.manual;
      if (year.fieldMeta && Object.keys(year.fieldMeta).length > 0) clean.fieldMeta = year.fieldMeta;
      return clean;
    });
  }

  function buildCorePayload() {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(core)) {
      if (YEAR_METADATA_KEYS.has(key)) continue;
      clean[key] = value;
    }
    return clean;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    const clientError = validateClient();
    if (clientError) {
      setFormError(clientError);
      return;
    }
    setSubmitting(true);
    try {
      const yearsPayload = buildYearPayload();
      const corePayload = buildCorePayload();
      const result =
        mode === "edit" && analysisId
          ? await updateAnalysisAction({
              id: analysisId,
              fields: corePayload,
              years: yearsPayload,
              removedYears,
            })
          : await saveNewAnalysisAction({
              origin: isImport ? "import" : "manual",
              data: { ...corePayload, years: yearsPayload },
            });

      if (!result.ok) {
        setFormError(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }
      toast.success(mode === "edit" ? "Financial data saved." : "Analysis created.");
      router.push(`/analysis/${result.data.id}`);
      router.refresh();
    } catch {
      setFormError("Unexpected error while saving. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const hasDerived = years.some((year) =>
    Object.values(year.fieldMeta ?? {}).some((origin) => origin === "derived"),
  );
  const hasMissingNote = missingCore > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isImport && meta ? (
        <Alert>
          <AlertTitle>Import review</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>
              Source: {meta.source ?? "Unknown"}
              {meta.retrievalDate ? ` · Retrieved ${formatDateTime(meta.retrievalDate)}` : ""}
              {meta.isDemo ? " · Synthetic demo data (not live financials)" : ""}
            </p>
            {meta.warnings && meta.warnings.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5">
                {meta.warnings.map((warning, index) => (
                  <li key={`${warning.code}-${index}`}>{warning.message}</li>
                ))}
              </ul>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {mode === "edit" ? (
        <Alert>
          <AlertTitle>Edit financial data</AlertTitle>
          <AlertDescription>
            Values loaded from your saved analysis. Editing one field leaves every other value — cash,
            debt, share price, historical figures and your thesis — untouched.
          </AlertDescription>
        </Alert>
      ) : null}

      {formError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      {mode === "manual" ? (
        <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Progress">
          <li className={step === 1 ? "font-semibold text-primary" : "text-muted-foreground"}>1. Company & valuation</li>
          <li aria-hidden className="text-muted-foreground">
            →
          </li>
          <li className={step === 2 ? "font-semibold text-primary" : "text-muted-foreground"}>2. Annual history</li>
        </ol>
      ) : null}

      {step === 1 ? (
        <div className="space-y-5">
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-medium">Company</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                def={{ key: "companyName", label: "Legal company name", kind: "text" }}
                value={core.companyName}
                onChange={(value) => setCoreField("companyName", value)}
                error={fieldErrors.companyName}
                ariaLabel="companyName"
              />
              <NumberField
                def={{ key: "ticker", label: "Ticker", kind: "text" }}
                value={core.ticker}
                onChange={(value) => setCoreField("ticker", value)}
                error={fieldErrors.ticker}
                ariaLabel="ticker"
              />
              <NumberField
                def={{ key: "industry", label: "Industry", kind: "text" }}
                value={core.industry}
                onChange={(value) => setCoreField("industry", value)}
                error={fieldErrors.industry}
                ariaLabel="industry"
              />
              <NumberField
                def={{ key: "exchange", label: "Exchange (optional)", kind: "text" }}
                value={core.exchange}
                onChange={(value) => setCoreField("exchange", value)}
                error={fieldErrors.exchange}
                ariaLabel="exchange"
              />
              <NumberField
                def={{ key: "country", label: "Country or region (optional)", kind: "text" }}
                value={core.country}
                onChange={(value) => setCoreField("country", value)}
                error={fieldErrors.country}
                ariaLabel="country"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-medium">Currency</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="reportingCurrency">Reporting currency</Label>
                <NativeSelect
                  id="reportingCurrency"
                  value={core.reportingCurrency}
                  onChange={(event) => setCoreField("reportingCurrency", event.target.value)}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </NativeSelect>
                {fieldErrors.reportingCurrency ? (
                  <p className="text-xs text-destructive">{fieldErrors.reportingCurrency}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label htmlFor="quoteCurrency">Quote currency (if different)</Label>
                <NativeSelect
                  id="quoteCurrency"
                  value={core.quoteCurrency}
                  onChange={(event) => setCoreField("quoteCurrency", event.target.value)}
                >
                  <option value="">Same as reporting currency</option>
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-medium">Market information</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MARKET_FIELDS.map((def) => (
                <NumberField
                  key={def.key}
                  def={def}
                  value={core[def.key] ?? ""}
                  onChange={(value) => setCoreField(def.key, value)}
                  error={fieldErrors[def.key]}
                  ariaLabel={def.key}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-medium">Valuation inputs</h2>
            <p className="text-xs text-muted-foreground">
              These cash and debt figures feed the valuation. They are kept separate from the
              historical balance-sheet values below.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {VALUATION_FIELDS.map((def) => (
                <NumberField
                  key={def.key}
                  def={def}
                  value={core[def.key] ?? ""}
                  onChange={(value) => setCoreField(def.key, value)}
                  error={fieldErrors[def.key]}
                  ariaLabel={def.key}
                />
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => {
                const error = validateClient();
                setFormError(error);
                if (!error) setStep(2);
              }}
            >
              Continue to annual history
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push(cancelHref)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          {mode !== "manual" ? (
            <>
              <section className="space-y-3">
                <h2 className="font-heading text-lg font-medium">Company</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(["companyName", "ticker", "industry", "exchange", "country"] as const).map((key) => (
                    <NumberField
                      key={key}
                      def={{
                        key,
                        label:
                          key === "companyName"
                            ? "Legal company name"
                            : key === "ticker"
                              ? "Ticker"
                              : key.charAt(0).toUpperCase() + key.slice(1),
                        kind: "text",
                      }}
                      value={core[key] ?? ""}
                      onChange={(value) => setCoreField(key, value)}
                      error={fieldErrors[key]}
                      ariaLabel={key}
                    />
                  ))}
                  <div className="space-y-1">
                    <Label htmlFor="reportingCurrency">Reporting currency</Label>
                    <NativeSelect
                      id="reportingCurrency"
                      value={core.reportingCurrency}
                      onChange={(event) => setCoreField("reportingCurrency", event.target.value)}
                    >
                      {CURRENCIES.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="quoteCurrency">Quote currency</Label>
                    <NativeSelect
                      id="quoteCurrency"
                      value={core.quoteCurrency}
                      onChange={(event) => setCoreField("quoteCurrency", event.target.value)}
                    >
                      <option value="">Same as reporting currency</option>
                      {CURRENCIES.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="font-heading text-lg font-medium">Market & valuation</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[...MARKET_FIELDS, ...VALUATION_FIELDS].map((def) => (
                    <NumberField
                      key={def.key}
                      def={def}
                      value={core[def.key] ?? ""}
                      onChange={(value) => setCoreField(def.key, value)}
                      error={fieldErrors[def.key]}
                      ariaLabel={def.key}
                    />
                  ))}
                </div>
              </section>
            </>
          ) : null}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-medium">Annual financial history</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Up to 5 years</Badge>
                {hasDerived ? <Badge variant="outline">Derived values labelled</Badge> : null}
                <Button type="button" variant="outline" size="sm" onClick={addYear} disabled={years.length >= 5}>
                  <Plus className="size-4" aria-hidden />
                  Add year
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded((value) => !value)}
                >
                  {expanded ? "Hide optional fields" : "Show optional fields"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Monetary values are in millions of the reporting currency; EPS is per share. Leave a
              field blank if the figure is unavailable — a blank is not the same as zero.
            </p>
            {hasMissingNote ? (
              <p className="text-xs text-muted-foreground">
                Tip: {missingCore} core field{missingCore === 1 ? "" : "s"} in the first year
                {missingCore === 1 ? " is" : " are"} blank. That is allowed — you can save now and fill
                it in later.
              </p>
            ) : null}
            <YearTable
              years={years}
              expanded={expanded}
              onChange={setYearField}
              onRemove={removeYear}
              errors={fieldErrors}
              showMetadata={mode !== "manual"}
            />
          </section>

          <div className="flex flex-wrap gap-3">
            {mode === "manual" ? (
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
            ) : null}
            {mode === "import" ? (
              <Button type="button" variant="ghost" onClick={() => router.push("/new/search")}>
                Back to search
              </Button>
            ) : null}
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Saving…"
                : (submitLabel ?? (mode === "edit" ? "Save financial data" : "Save analysis"))}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push(cancelHref)}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </form>
  );
}