import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

// Platform detection
export const isNative = Capacitor.isNativePlatform();
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isWeb = Capacitor.getPlatform() === 'web';

// Initialize native features (don't hide splash yet)
export const initializeCapacitor = async () => {
  if (!isNative) return;

  try {
    // Configure status bar for terminal aesthetic
    await StatusBar.setStyle({ style: Style.Dark });
    if (isIOS) {
      await StatusBar.setBackgroundColor({ color: '#0a0a0a' });
    }

    // Handle app URL open (for deep links / Supabase auth)
    App.addListener('appUrlOpen', (data) => {
      console.log('App opened with URL:', data.url);
      // Handle Supabase auth callbacks
      if (data.url.includes('type=recovery') || data.url.includes('access_token')) {
        window.location.hash = data.url.split('#')[1] || '';
      }
    });

    // Handle app state changes
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        // Trigger data refresh when app becomes active
        window.dispatchEvent(new CustomEvent('app-resume'));
      }
    });

  } catch (error) {
    console.error('Error initializing Capacitor:', error);
  }
};

// Hide splash screen - call after boot animation completes
export const hideSplashScreen = async () => {
  if (!isNative) return;
  try {
    await SplashScreen.hide();
  } catch (error) {
    console.error('Error hiding splash screen:', error);
  }
};

// Safe area insets for iOS
export const getSafeAreaInsets = () => {
  if (!isIOS) return { top: 0, bottom: 0, left: 0, right: 0 };

  const style = getComputedStyle(document.documentElement);
  return {
    top: parseInt(style.getPropertyValue('--sat') || '0', 10),
    bottom: parseInt(style.getPropertyValue('--sab') || '0', 10),
    left: parseInt(style.getPropertyValue('--sal') || '0', 10),
    right: parseInt(style.getPropertyValue('--sar') || '0', 10)
  };
};
