import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Recommendation } from "@/lib/constants";

const STYLES: Record<Recommendation, string> = {
  Buy: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-600/20",
  Hold: "bg-amber-100 text-amber-900 ring-1 ring-amber-600/20",
  Sell: "bg-rose-100 text-rose-800 ring-1 ring-rose-600/20",
};

export function RecommendationBadge({
  recommendation,
  className,
}: {
  recommendation: Recommendation | null;
  className?: string;
}) {
  if (!recommendation) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        Not rated
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("border-transparent", STYLES[recommendation], className)}>
      {recommendation}
    </Badge>
  );
}