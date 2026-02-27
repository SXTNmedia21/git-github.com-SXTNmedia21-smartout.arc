import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'SmartOut - Møt fremtidens workforce management',
    description: 'AI-drevet workforce management for den norske serveringsbransjen.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="no" className="dark">
            <body className="antialiased bg-zinc-950 text-white selection:bg-orange-500/30">
                {children}
            </body>
        </html>
    );
}
