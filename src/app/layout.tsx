import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gamely - Quiz Game',
  description: 'A two-team quiz game show',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-arabic min-h-screen">
        {children}
      </body>
    </html>
  )
}
