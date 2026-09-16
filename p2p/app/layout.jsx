import './globals.css';

export const metadata = {
  title: 'Secure Voice',
  description: 'P2P encrypted voice calling',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Voice',
  },
};

// Next.js 16 me themeColor + viewport alag export me jaate hain
export const viewport = {
  themeColor: '#0ea5e9',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-slate-950 antialiased">{children}</body>
    </html>
  );
}