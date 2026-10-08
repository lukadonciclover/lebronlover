import Link from "next/link";
import { CompanySearch } from "@/components/company-search";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Company search</h1>
        <p className="text-sm text-muted-foreground">
          Search by ticker or company name. Exact ticker matches are shown first, and alternative
          results remain selectable.
        </p>
      </header>

      <CompanySearch />

      <div className="flex flex-wrap gap-3 border-t pt-4">
        <Link href="/new/manual" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Enter financials manually instead
        </Link>
        <Link href="/new" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Back to new analysis
        </Link>
      </div>
    </div>
  );
}