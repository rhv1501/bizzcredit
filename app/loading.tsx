export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-40 bg-muted animate-pulse rounded-md" />
        <div className="mt-2 h-4 w-64 bg-muted animate-pulse rounded-md" />
      </div>

      {/* Stat Cards Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6">
            <div className="h-4 w-24 bg-muted animate-pulse rounded-md" />
            <div className="mt-4 h-8 w-32 bg-muted animate-pulse rounded-md" />
            <div className="mt-2 h-3 w-40 bg-muted animate-pulse rounded-md" />
          </div>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="lg:col-span-4 rounded-lg border bg-card p-6">
          <div className="h-[250px] bg-muted animate-pulse rounded-md" />
        </div>
        <div className="lg:col-span-3 rounded-lg border bg-card p-6">
          <div className="h-[250px] bg-muted animate-pulse rounded-md" />
        </div>
      </div>

      {/* Recent Credits Skeleton */}
      <div className="rounded-lg border bg-card p-6">
        <div className="h-6 w-32 bg-muted animate-pulse rounded-md" />
        <div className="mt-4 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
