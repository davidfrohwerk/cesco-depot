import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'CESCo Depot · Continuity in custody', description: 'Client-owned equipment, strategic spares, recovery services, and accountable billing.' };
export default function Layout({ children }: {
    children: React.ReactNode;
}) { return <html lang="en"><body>{children}</body></html>; }
