import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';

// Platform detection
export const isNativePlatform = () => Capacitor.isNativePlatform();
export const getPlatform = () => Capacitor.getPlatform();
export const isIOS = () => getPlatform() === 'ios';
export const isAndroid = () => getPlatform() === 'android';
export const isWeb = () => getPlatform() === 'web';

// PWA detection - returns true if running as installed PWA or native app
export const isPWAOrMobile = () => {
  // If running in Capacitor (native mobile), return true
  if (isNativePlatform()) return true;

  // Check if running as installed PWA
  if (typeof window === 'undefined') return false;

  // Check display mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  // Check iOS standalone mode
  const isIOSStandalone = (window.navigator as any).standalone === true;

  return isStandalone || isIOSStandalone;
};

// Returns true only if running in regular web browser (not PWA, not mobile app)
export const isBrowserOnly = () => !isPWAOrMobile();

// Storage utilities (replaces localStorage)
export const storage = {
  async get(key: string): Promise<string | null> {
    if (!isNativePlatform()) {
      return localStorage.getItem(key);
    }
    const { value } = await Preferences.get({ key });
    return value;
  },

  async set(key: string, value: string): Promise<void> {
    if (!isNativePlatform()) {
      localStorage.setItem(key, value);
      return;
    }
    await Preferences.set({ key, value });
  },

  async remove(key: string): Promise<void> {
    if (!isNativePlatform()) {
      localStorage.removeItem(key);
      return;
    }
    await Preferences.remove({ key });
  },

  async clear(): Promise<void> {
    if (!isNativePlatform()) {
      localStorage.clear();
      return;
    }
    await Preferences.clear();
  },

  async keys(): Promise<string[]> {
    if (!isNativePlatform()) {
      return Object.keys(localStorage);
    }
    const { keys } = await Preferences.keys();
    return keys;
  }
};

// Cache utilities for offline data
export const cache = {
  async setJSON(key: string, data: any): Promise<void> {
    const json = JSON.stringify(data);
    await storage.set(`cache:${key}`, json);
  },

  async getJSON<T>(key: string): Promise<T | null> {
    const json = await storage.get(`cache:${key}`);
    if (!json) return null;
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  },

  async remove(key: string): Promise<void> {
    await storage.remove(`cache:${key}`);
  },

  async clear(): Promise<void> {
    const keys = await storage.keys();
    const cacheKeys = keys.filter(k => k.startsWith('cache:'));
    await Promise.all(cacheKeys.map(k => storage.remove(k)));
  }
};

// Haptics utilities
export const haptics = {
  async light(): Promise<void> {
    if (!isNativePlatform()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
      console.warn('Haptics not available:', e);
    }
  },

  async medium(): Promise<void> {
    if (!isNativePlatform()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {
      console.warn('Haptics not available:', e);
    }
  },

  async heavy(): Promise<void> {
    if (!isNativePlatform()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (e) {
      console.warn('Haptics not available:', e);
    }
  },

  async success(): Promise<void> {
    if (!isNativePlatform()) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (e) {
      console.warn('Haptics not available:', e);
    }
  },

  async warning(): Promise<void> {
    if (!isNativePlatform()) return;
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch (e) {
      console.warn('Haptics not available:', e);
    }
  },

  async error(): Promise<void> {
    if (!isNativePlatform()) return;
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch (e) {
      console.warn('Haptics not available:', e);
    }
  }
};

// Keyboard utilities
export const keyboard = {
  async show(): Promise<void> {
    if (!isNativePlatform()) return;
    try {
      await Keyboard.show();
    } catch (e) {
      console.warn('Keyboard control not available:', e);
    }
  },

  async hide(): Promise<void> {
    if (!isNativePlatform()) return;
    try {
      await Keyboard.hide();
    } catch (e) {
      console.warn('Keyboard control not available:', e);
    }
  },

  async setAccessoryBarVisible(visible: boolean): Promise<void> {
    if (!isNativePlatform() || !isIOS()) return;
    try {
      await Keyboard.setAccessoryBarVisible({ isVisible: visible });
    } catch (e) {
      console.warn('Keyboard accessory bar control not available:', e);
    }
  },

  onShow(callback: () => void): () => void {
    if (!isNativePlatform()) return () => {};
    const listener = Keyboard.addListener('keyboardWillShow', callback);
    return () => listener.remove();
  },

  onHide(callback: () => void): () => void {
    if (!isNativePlatform()) return () => {};
    const listener = Keyboard.addListener('keyboardWillHide', callback);
    return () => listener.remove();
  }
};

// Status bar utilities
export const statusBar = {
  async setStyle(style: 'light' | 'dark'): Promise<void> {
    if (!isNativePlatform()) return;
    try {
      await StatusBar.setStyle({
        style: style === 'light' ? Style.Light : Style.Dark
      });
    } catch (e) {
      console.warn('Status bar control not available:', e);
    }
  },

  async setBackgroundColor(color: string): Promise<void> {
    if (!isNativePlatform() || isIOS()) return;
    try {
      await StatusBar.setBackgroundColor({ color });
    } catch (e) {
      console.warn('Status bar background color not available:', e);
    }
  },

  async show(): Promise<void> {
    if (!isNativePlatform()) return;
    try {
      await StatusBar.show();
    } catch (e) {
      console.warn('Status bar control not available:', e);
    }
  },

  async hide(): Promise<void> {
    if (!isNativePlatform()) return;
    try {
      await StatusBar.hide();
    } catch (e) {
      console.warn('Status bar control not available:', e);
    }
  }
};
