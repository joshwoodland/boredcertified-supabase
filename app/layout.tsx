import './styles/globals.css'
import { Inter, Montserrat } from 'next/font/google'
import ThemeProvider from './components/ThemeProvider'
import { AppSettingsProvider } from './providers/AppSettingsProvider'

const inter = Inter({ subsets: ['latin'] })
const montserrat = Montserrat({ 
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-montserrat'
})

export const metadata = {
  title: 'Bored Certified',
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
          
          /* Modern scrollbar */
          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          
          ::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.05);
            border-radius: 8px;
          }
          
          ::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, 0.15);
            border-radius: 8px;
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(0, 0, 0, 0.25);
          }
          
          /* Dark mode scrollbar */
          .dark ::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
          }
          
          .dark ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
          }
          
          .dark ::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.25);
          }
        `}} />
      </head>
      <body className={`${inter.className} ${montserrat.variable} min-h-screen dark:bg-dark-main bg-gray-50`}>
        <AppSettingsProvider>
          <ThemeProvider />
          <main className="min-h-screen">
            {children}
          </main>
        </AppSettingsProvider>
      </body>
    </html>
  )
} 
