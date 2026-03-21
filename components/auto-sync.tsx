"use client";

import { useEffect, useRef } from "react";
import { syncToSheets } from "@/lib/sync";
import { toast } from "sonner";
import Pusher from "pusher-js";

export function AutoSync() {
  const isSyncing = useRef(false);

  useEffect(() => {
    const doSync = async (source?: string | Event) => {
      if (isSyncing.current) return;
      if (typeof window === "undefined" || !window.navigator.onLine) return; // Only sync when online

      isSyncing.current = true;
      const isSocket = typeof source === 'string' && source === 'socket';
      const toastId = toast.loading(`Syncing... ${isSocket ? '(Real-Time)' : ''}`);
      
      try {
        const result = await syncToSheets();
        if (result.synced > 0) {
          toast.success(`Auto-synced ${result.synced} offline item(s) to Sheets.`, { id: toastId });
        } else {
          toast.success("App synced & up to date!", { id: toastId, duration: 2000 });
        }
      } catch (error: any) {
        console.error("Auto-sync error:", error);
        toast.error("Auto-sync failed. Please check your connection.", { id: toastId });
      } finally {
        isSyncing.current = false;
      }
    };

    if (typeof window === "undefined") return;

    // 1. Recover connectivity handlers
    if (window.navigator.onLine) {
      setTimeout(doSync, 2000); // Small delay on load
    }
    window.addEventListener("online", doSync);

    // 2. Pusher Real-Time WebSocket Connection
    let pusher: Pusher | null = null;
    let channel: any = null;

    if (
      process.env.NEXT_PUBLIC_PUSHER_APP_KEY && 
      process.env.NEXT_PUBLIC_PUSHER_APP_KEY !== 'your_pusher_key_here'
    ) {
      pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_APP_KEY, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2',
      });

      channel = pusher.subscribe('bizzcredit-sync');
      channel.bind('sheet-updated', () => {
        // Triggered instantly by Vercel when Google Sheets hits the webhook!
        doSync('socket');
      });
    }

    return () => {
      window.removeEventListener("online", doSync);
      
      if (channel) {
        channel.unbind_all();
        channel.unsubscribe();
      }
      if (pusher) pusher.disconnect();
    };
  }, []);

  return null;
}
