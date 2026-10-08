import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FinancialRecord } from "@/lib/db/repository";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

type Row = {
  key: keyof FinancialRecord;
  label: string;
  kind: "money" | "perShare";
};

const ROWS: Row[] = [
  { key: "revenue", label: "Revenue", kind: "money" },
  { key: "grossProfit", label: "Gross profit", kind: "money" },
  { key: "ebitda", label: "EBITDA", kind: "money" },
  { key: "operatingIncome", label: "Operating income (EBIT)", kind: "money" },
  { key: "netIncome", label: "Net income", kind: "money" },
  { key: "eps", label: "EPS", kind: "perShare" },
  { key: "freeCashFlow", label: "Free cash flow", kind: "money" },
  { key: "operatingCashFlow", label: "Operating cash flow", kind: "money" },
  { key: "capex", label: "Capital expenditure", kind: "money" },
  { key: "cashAndEquivalents", label: "Cash and equivalents", kind: "money" },
  { key: "shortTermInvestments", label: "Short-term investments", kind: "money" },
  { key: "totalAssets", label: "Total assets", kind: "money" },
  { key: "totalDebt", label: "Total debt", kind: "money" },
  { key: "shareholdersEquity", label: "Shareholders' equity", kind: "money" },
];

export function FinancialTable({
  statements,
  currency,
}: {
  statements: readonly FinancialRecord[];
  currency: string;
}) {
  if (statements.length === 0) {
    return <p className="text-sm text-muted-foreground">No annual statements saved yet.</p>;
  }
  const chronological = [...statements].sort((a, b) => a.fiscalYear - b.fiscalYear);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 min-w-[180px] bg-card">Metric</TableHead>
            {chronological.map((statement) => (
              <TableHead key={statement.fiscalYear} className="min-w-[120px] text-right">
                FY{statement.fiscalYear}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((row) => (
            <TableRow key={row.key}>
              <TableHead scope="row" className="sticky left-0 z-10 bg-card font-medium">
                {row.label}
                {row.kind === "money" ? (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">({currency} m)</span>
                ) : (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">(per share)</span>
                )}
              </TableHead>
              {chronological.map((statement) => {
                const value = statement[row.key] as number | null;
                const derived = statement.fieldMeta?.[row.key as keyof typeof statement.fieldMeta] === "derived";
                return (
                  <TableCell key={statement.fiscalYear} className="text-right tabular-nums">
                    {row.kind === "money"
                      ? formatMoney(value, currency)
                      : formatNumber(value, 2)}
                    {derived ? (
                      <span className="ml-1 align-super text-[10px] uppercase text-amber-600" title="Derived value">
                        d
                      </span>
                    ) : null}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
          <TableRow>
            <TableHead scope="row" className="sticky left-0 z-10 bg-muted/40 text-xs text-muted-foreground">
              Source
            </TableHead>
            {chronological.map((statement) => (
              <TableCell key={statement.fiscalYear} className="text-right text-xs text-muted-foreground">
                {statement.source || "—"}
              </TableCell>
            ))}
          </TableRow>
          <TableRow>
            <TableHead scope="row" className="sticky left-0 z-10 bg-muted/40 text-xs text-muted-foreground">
              Retrieved
            </TableHead>
            {chronological.map((statement) => (
              <TableCell key={statement.fiscalYear} className="text-right text-xs text-muted-foreground">
                {formatDate(statement.retrievalDate)}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}