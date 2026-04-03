"use client";

import { ErrorBoundary } from "@/components/error-boundary";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="h-full">
          <ErrorBoundary error={error} reset={reset} />
        </div>
      </body>
    </html>
  );
}
