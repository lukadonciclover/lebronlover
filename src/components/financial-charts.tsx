"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/format";

export type ChartPoint = {
  fiscalYear: number;
  revenue: number | null;
  ebitda: number | null;
  freeCashFlow: number | null;
};

function axisTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function TooltipContent({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: string | number;
  currency: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-popover-foreground">FY{label}</p>
      <ul className="space-y-0.5">
        {payload.map((entry) => (
          <li key={entry.dataKey} className="flex items-center gap-2 text-popover-foreground">
            <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden />
            <span>{entry.name}:</span>
            <span className="font-medium tabular-nums">
              {formatMoney(typeof entry.value === "number" ? entry.value : null, currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const CHART_HEIGHT = 260;

export function RevenueChart({ data, currency }: { data: ChartPoint[]; currency: string }) {
  return (
    <div className="w-full" role="img" aria-label={`Revenue by fiscal year in ${currency} millions`}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="fiscalYear" tickFormatter={(value) => `FY${value}`} tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickFormatter={axisTick} tickLine={false} axisLine={false} width={48} fontSize={12} />
          <Tooltip
            content={<TooltipContent currency={currency} />}
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          />
          <Bar dataKey="revenue" name="Revenue" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EbitdaFcfChart({ data, currency }: { data: ChartPoint[]; currency: string }) {
  return (
    <div className="w-full" role="img" aria-label={`EBITDA and free cash flow by fiscal year in ${currency} millions`}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="fiscalYear" tickFormatter={(value) => `FY${value}`} tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickFormatter={axisTick} tickLine={false} axisLine={false} width={48} fontSize={12} />
          <Tooltip
            content={<TooltipContent currency={currency} />}
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="ebitda" name="EBITDA" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="freeCashFlow" name="Free cash flow" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}