import { CapacitorConfig } from '@capacitor/cli'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-production-domain.example.com'

const config: CapacitorConfig = {
  appId: 'com.bombily.app',
  appName: 'Бомбилы',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    url: APP_URL,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#FFD700',
      showSpinner: false,
    },
  },
}

export default config

