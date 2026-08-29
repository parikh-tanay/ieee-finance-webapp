import './globals.css';
import { Rajdhani, Inter, JetBrains_Mono } from 'next/font/google';

const rajdhani = Rajdhani({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-display' });
const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata = {
  title: 'IEEE SB Finance Tracker',
  description: 'Income & expense tracking for IEEE Student Branch events',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${rajdhani.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-bg text-ink min-h-screen">{children}</body>
    </html>
  );
}
