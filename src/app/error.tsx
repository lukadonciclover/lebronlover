"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We could not load this page. This is often temporary — try again. If the problem
            persists, return to the dashboard.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => retry()}>
              Try again
            </Button>
            <Link href="/" className="text-sm text-primary underline underline-offset-4">
              Back to dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}