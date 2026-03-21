import { NextResponse } from 'next/server';
import Pusher from 'pusher';

export async function POST(req: Request) {
  try {
    // Basic verification - ensure env vars exist
    if (!process.env.PUSHER_APP_ID || !process.env.NEXT_PUBLIC_PUSHER_APP_KEY || !process.env.PUSHER_SECRET || !process.env.NEXT_PUBLIC_PUSHER_CLUSTER) {
      return NextResponse.json({ error: 'Pusher not configured' }, { status: 500 });
    }

    const pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
      useTLS: true,
    });

    // Trigger the 'sheet-updated' event on the 'bizzcredit-sync' channel
    await pusher.trigger('bizzcredit-sync', 'sheet-updated', {
      timestamp: Date.now(),
      message: 'Google Sheets data was modified.'
    });

    return NextResponse.json({ success: true, message: 'Push notification triggered' });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
