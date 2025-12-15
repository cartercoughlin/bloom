import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.budgetapp.app',
  appName: 'Bloom Budget',
  webDir: 'public',
  server: {
    // For production
    url: 'https://bloom-budget.vercel.app',

    // For local development - uncomment below and comment above
    //url: 'http://192.168.1.208:3000',
    //cleartext: true,

    androidScheme: 'https',
    iosScheme: 'capacitor'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#22c55e'
    }
  }
};

export default config;
