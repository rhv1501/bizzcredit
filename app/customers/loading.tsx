export default function CustomersLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
        <div className="mt-2 h-4 w-64 bg-muted animate-pulse rounded-md" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6">
            <div className="h-6 w-32 bg-muted animate-pulse rounded-md" />
            <div className="mt-3 space-y-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded-md" />
              <div className="h-4 w-32 bg-muted animate-pulse rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
