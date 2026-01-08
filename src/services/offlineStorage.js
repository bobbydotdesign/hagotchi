import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import { isNative } from '../lib/capacitor';

const HABITS_KEY = 'habito_habits_cache_v2';
const PENDING_SYNC_KEY = 'habito_pending_sync';
const LAST_SYNC_KEY = 'habito_last_sync';

// Network status
let isOnline = true;

// Initialize network listener
export const initNetworkListener = (onStatusChange) => {
  if (!isNative) {
    // Web fallback
    window.addEventListener('online', () => {
      isOnline = true;
      onStatusChange?.(true);
    });
    window.addEventListener('offline', () => {
      isOnline = false;
      onStatusChange?.(false);
    });
    isOnline = navigator.onLine;
    return;
  }

  Network.addListener('networkStatusChange', (status) => {
    isOnline = status.connected;
    onStatusChange?.(status.connected);
  });

  // Get initial status
  Network.getStatus().then((status) => {
    isOnline = status.connected;
  });
};

export const getNetworkStatus = () => isOnline;

// Save habits to local storage (enhanced for offline)
export const saveHabitsLocally = async (habits) => {
  const data = JSON.stringify({
    habits,
    timestamp: Date.now()
  });

  if (isNative) {
    await Preferences.set({ key: HABITS_KEY, value: data });
  } else {
    localStorage.setItem(HABITS_KEY, data);
  }
};

// Load habits from local storage
export const loadHabitsLocally = async () => {
  try {
    let data;
    if (isNative) {
      const result = await Preferences.get({ key: HABITS_KEY });
      data = result.value;
    } else {
      data = localStorage.getItem(HABITS_KEY);
    }

    if (!data) return { habits: [], timestamp: 0 };

    const parsed = JSON.parse(data);
    // Handle old format (just array) vs new format (object with timestamp)
    if (Array.isArray(parsed)) {
      return { habits: parsed, timestamp: 0 };
    }
    return parsed;
  } catch (error) {
    console.error('Error loading local habits:', error);
    return { habits: [], timestamp: 0 };
  }
};

// Queue an action for sync when back online
export const queueForSync = async (action) => {
  try {
    let pending;
    if (isNative) {
      const result = await Preferences.get({ key: PENDING_SYNC_KEY });
      pending = result.value ? JSON.parse(result.value) : [];
    } else {
      const data = localStorage.getItem(PENDING_SYNC_KEY);
      pending = data ? JSON.parse(data) : [];
    }

    // Add action with timestamp
    pending.push({
      ...action,
      queuedAt: Date.now()
    });

    const data = JSON.stringify(pending);
    if (isNative) {
      await Preferences.set({ key: PENDING_SYNC_KEY, value: data });
    } else {
      localStorage.setItem(PENDING_SYNC_KEY, data);
    }
  } catch (error) {
    console.error('Error queuing action for sync:', error);
  }
};

// Get pending sync actions
export const getPendingSync = async () => {
  try {
    if (isNative) {
      const result = await Preferences.get({ key: PENDING_SYNC_KEY });
      return result.value ? JSON.parse(result.value) : [];
    } else {
      const data = localStorage.getItem(PENDING_SYNC_KEY);
      return data ? JSON.parse(data) : [];
    }
  } catch (error) {
    return [];
  }
};

// Clear pending sync after successful sync
export const clearPendingSync = async () => {
  if (isNative) {
    await Preferences.remove({ key: PENDING_SYNC_KEY });
  } else {
    localStorage.removeItem(PENDING_SYNC_KEY);
  }
};

// Update last sync timestamp
export const updateLastSync = async () => {
  const timestamp = Date.now().toString();
  if (isNative) {
    await Preferences.set({ key: LAST_SYNC_KEY, value: timestamp });
  } else {
    localStorage.setItem(LAST_SYNC_KEY, timestamp);
  }
};

// Get last sync timestamp
export const getLastSync = async () => {
  if (isNative) {
    const result = await Preferences.get({ key: LAST_SYNC_KEY });
    return result.value ? parseInt(result.value, 10) : 0;
  } else {
    const data = localStorage.getItem(LAST_SYNC_KEY);
    return data ? parseInt(data, 10) : 0;
  }
};
