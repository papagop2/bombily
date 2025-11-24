import type { Metadata } from 'next'
import './globals.css'
import { AudioPermissionProvider } from '@/components/AudioPermissionProvider'

export const metadata: Metadata = {
  title: 'Бомбилы — Такси, грузоперевозки и доставка',
  description: 'Бомбилы: одно приложение для пассажиров, водителей и доставки',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <head>
        <meta name="theme-color" content="#FFD700" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <AudioPermissionProvider>
          {children}
        </AudioPermissionProvider>
      </body>
    </html>
  )
}
