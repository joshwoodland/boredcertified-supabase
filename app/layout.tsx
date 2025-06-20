import './styles/globals.css'
import { Inter, Montserrat } from 'next/font/google'
import ThemeProvider from './components/ThemeProvider'
import { AppSettingsProvider } from './providers/AppSettingsProvider'
import DeepgramSecurityCheck from './components/DeepgramSecurityCheck'
import { DeepgramContextProvider } from './context/DeepgramContextProvider'
import { MicrophoneContextProvider } from './context/MicrophoneContextProvider'

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
    <html lang="en" className="dark" style={{ colorScheme: 'dark' }}>
      <body className={`${inter.className} ${montserrat.variable} min-h-screen bg-background text-foreground dark`}>
        <AppSettingsProvider>
          <DeepgramContextProvider>
            <MicrophoneContextProvider>
              <ThemeProvider />
              <DeepgramSecurityCheck />
              <main className="min-h-screen">
                {children}
              </main>
            </MicrophoneContextProvider>
          </DeepgramContextProvider>
        </AppSettingsProvider>
      </body>
    </html>
  )
}
