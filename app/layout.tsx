import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Branch-Out | Build trust through real work',
  description:
    'Find proven collaborators, begin with a focused milestone, and build a reputation through shared work.',
  icons: {
    icon: '/favicon.svg',
  },
};

// Runs before paint so returning visitors do not see the wrong theme flash briefly.
const themeBootScript = `
  try {
    const saved = localStorage.getItem('branch-out-theme');
    const theme = saved === 'light' || saved === 'dark'
      ? saved
      : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (_) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
