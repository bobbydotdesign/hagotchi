import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from '../lib/capacitor';

// Light impact - for UI interactions (button taps)
export const hapticLight = async () => {
  if (!isNative) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (error) {
    console.warn('Haptic feedback not available');
  }
};

// Medium impact - for habit completion
export const hapticMedium = async () => {
  if (!isNative) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (error) {
    console.warn('Haptic feedback not available');
  }
};

// Heavy impact - for significant actions (streak milestones)
export const hapticHeavy = async () => {
  if (!isNative) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (error) {
    console.warn('Haptic feedback not available');
  }
};

// Success notification - for completing all daily habits
export const hapticSuccess = async () => {
  if (!isNative) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (error) {
    console.warn('Haptic feedback not available');
  }
};

// Warning notification - for breaking streak warnings
export const hapticWarning = async () => {
  if (!isNative) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (error) {
    console.warn('Haptic feedback not available');
  }
};

// Error notification - for delete actions
export const hapticError = async () => {
  if (!isNative) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch (error) {
    console.warn('Haptic feedback not available');
  }
};

// Selection changed - for drag and drop reordering
export const hapticSelection = async () => {
  if (!isNative) return;
  try {
    await Haptics.selectionChanged();
  } catch (error) {
    console.warn('Haptic feedback not available');
  }
};

// Vibrate pattern - for streak milestones (7, 30, 100 days)
export const hapticStreakMilestone = async (streakDays) => {
  if (!isNative) return;

  try {
    if (streakDays >= 100) {
      // Triple heavy for 100+ day streak
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await new Promise(r => setTimeout(r, 100));
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await new Promise(r => setTimeout(r, 100));
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else if (streakDays >= 30) {
      // Double medium for 30+ day streak
      await Haptics.impact({ style: ImpactStyle.Medium });
      await new Promise(r => setTimeout(r, 80));
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (streakDays >= 7) {
      // Single medium for 7+ day streak
      await Haptics.notification({ type: NotificationType.Success });
    }
  } catch (error) {
    console.warn('Haptic feedback not available');
  }
};
