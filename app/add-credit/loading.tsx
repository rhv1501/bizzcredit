export default function AddCreditLoading() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-10">
      <div>
        <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
        <div className="mt-2 h-4 w-64 bg-muted animate-pulse rounded-md" />
      </div>

      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-6">
          <div className="h-6 w-32 bg-muted animate-pulse rounded-md" />
          <div className="mt-4 space-y-3">
            <div className="h-10 bg-muted animate-pulse rounded-md" />
            <div className="h-10 bg-muted animate-pulse rounded-md" />
            <div className="h-10 bg-muted animate-pulse rounded-md" />
          </div>
        </div>
      ))}

      <div className="h-12 w-32 bg-muted animate-pulse rounded-md" />
    </div>
  );
}
