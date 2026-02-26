import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jonas.fluentup',
  appName: "FluentUp",
  webDir: 'frontend/dist',   // <— vigtigt, hvis dit frontend bygger til frontend/dist
  server: { androidScheme: 'https' },
};

export default config;
