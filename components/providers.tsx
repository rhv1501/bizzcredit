"use client";

import dynamic from "next/dynamic";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

// Dynamically import AutoSync to avoid blocking the main thread
const AutoSync = dynamic(
  () => import("./auto-sync").then((mod) => ({ default: mod.AutoSync })),
  {
    ssr: false,
  },
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <Toaster />
      <AutoSync />
    </ThemeProvider>
  );
}
