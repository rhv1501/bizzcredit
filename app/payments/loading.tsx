export default function PaymentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
          <div className="mt-2 h-4 w-64 bg-muted animate-pulse rounded-md" />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
