export default function CustomerDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-muted animate-pulse rounded-md" />
        <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <div className="space-y-3">
            <div className="h-6 w-32 bg-muted animate-pulse rounded-md" />
            <div className="h-4 w-40 bg-muted animate-pulse rounded-md" />
            <div className="h-4 w-40 bg-muted animate-pulse rounded-md" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="space-y-3">
            <div className="h-6 w-32 bg-muted animate-pulse rounded-md" />
            <div className="h-4 w-40 bg-muted animate-pulse rounded-md" />
            <div className="h-4 w-40 bg-muted animate-pulse rounded-md" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="h-6 w-32 bg-muted animate-pulse rounded-md mb-4" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
