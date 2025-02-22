import './styles/globals.css'
import { Inter } from 'next/font/google'
import ThemeProvider from './components/ThemeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Medical Scribe Assistant',
  description: 'AI-powered SOAP note generation for medical professionals',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          .modal-open > main {
            filter: brightness(40%) blur(1px);
            transition: filter 0.2s ease-in-out;
            pointer-events: none;
          }
          .settings-modal {
            isolation: isolate;
            pointer-events: auto;
            filter: none !important;
          }
        `}} />
      </head>
      <body className={`${inter.className} min-h-screen dark:bg-dark-main`}>
        <ThemeProvider />
        <main>
          {children}
        </main>
      </body>
    </html>
  )
} 