"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console in development
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <div className="rounded-lg bg-red-50 p-4 dark:bg-red-500/10">
        <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">
          Something went wrong!
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. Try refreshing the page or go back.
        </p>
      </div>
      <button
        onClick={() => reset()}
        className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
