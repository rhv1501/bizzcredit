"use client";

import { ErrorBoundary } from "@/components/error-boundary";

export default function RecordsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundary error={error} reset={reset} />;
}
