import './globals.css';

export const metadata = {
  title: 'IEEE SB Finance Tracker',
  description: 'Income & expense tracking for IEEE Student Branch events',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-ink min-h-screen">{children}</body>
    </html>
  );
}
