import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="font-heading text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        The page you are looking for does not exist or may have been moved.
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