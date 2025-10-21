import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jonas.accentcoach',
  appName: 'Accent Coach AI',
  webDir: 'frontend/dist',   // <— vigtigt, hvis dit frontend bygger til frontend/dist
  server: { androidScheme: 'https' },
};

export default config;
