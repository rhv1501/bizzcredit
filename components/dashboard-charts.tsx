import dynamic from "next/dynamic";
import { Suspense } from "react";

const RevenueChartClient = dynamic(
  () =>
    import("./dashboard-charts-client").then((mod) => ({
      default: mod.RevenueChart,
    })),
  { loading: () => <ChartSkeleton />, ssr: false },
);

const StatusChartClient = dynamic(
  () =>
    import("./dashboard-charts-client").then((mod) => ({
      default: mod.StatusChart,
    })),
  { loading: () => <ChartSkeleton />, ssr: false },
);

function ChartSkeleton() {
  return (
    <div className="h-[250px] w-full bg-muted/40 animate-pulse rounded-md flex items-center justify-center">
      <div className="text-sm text-muted-foreground">Loading chart...</div>
    </div>
  );
}

export function RevenueChart() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <RevenueChartClient />
    </Suspense>
  );
}

export function StatusChart() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <StatusChartClient />
    </Suspense>
  );
}
