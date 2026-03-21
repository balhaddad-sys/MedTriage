import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.medtriage.app',
  appName: 'MedTriage',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    CapacitorNfc: {
      // Auto-start NFC on app launch (Android)
      autoStart: false,
    },
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'MedTriage',
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
};

export default config;
