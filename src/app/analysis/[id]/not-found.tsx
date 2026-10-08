import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AnalysisNotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
      <p className="text-sm font-medium text-primary">Not found</p>
      <h1 className="font-heading text-2xl font-semibold">Analysis not found</h1>
      <p className="text-sm text-muted-foreground">
        This analysis does not exist, or it belongs to a different workspace and is not visible here.
      </p>
      <div className="flex justify-center gap-3">
        <Link href="/" className={cn(buttonVariants({}))}>
          Back to dashboard
        </Link>
        <Link href="/new" className={cn(buttonVariants({ variant: "outline" }))}>
          New analysis
        </Link>
      </div>
    </div>
  );
}