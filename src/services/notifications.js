import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from '../lib/capacitor';

// Notification permission status
let notificationPermission = 'default';

// Request notification permissions
export const requestNotificationPermission = async () => {
  if (!isNative) {
    // Web fallback using Notification API
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      notificationPermission = result;
      return result === 'granted';
    }
    return false;
  }

  try {
    const result = await LocalNotifications.requestPermissions();
    notificationPermission = result.display;
    return result.display === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

// Check current permission status
export const checkNotificationPermission = async () => {
  if (!isNative) {
    return 'Notification' in window ? Notification.permission : 'denied';
  }

  try {
    const result = await LocalNotifications.checkPermissions();
    return result.display;
  } catch (error) {
    return 'denied';
  }
};

// Generate unique notification ID from habit ID and day
const generateNotificationId = (habitId, dayOfWeek) => {
  // Create a hash from UUID to get a numeric ID
  const hash = habitId.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return Math.abs(hash * 10 + dayOfWeek);
};

// Schedule notifications for a habit based on scheduled_time and scheduled_days
export const scheduleHabitNotifications = async (habit) => {
  if (!isNative || !habit.scheduled_time) return;

  const permission = await checkNotificationPermission();
  if (permission !== 'granted') return;

  // Cancel existing notifications for this habit
  await cancelHabitNotifications(habit.id);

  const scheduledDays = habit.scheduled_days || [0, 1, 2, 3, 4, 5, 6];
  const [hours, minutes] = habit.scheduled_time.split(':').map(Number);

  // Create notifications for each scheduled day
  const notifications = scheduledDays.map((dayOfWeek) => {
    // Calculate next occurrence of this day
    const now = new Date();
    const currentDay = now.getDay();
    let daysUntil = dayOfWeek - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && now.getHours() >= hours)) {
      daysUntil += 7;
    }

    const scheduledDate = new Date(now);
    scheduledDate.setDate(now.getDate() + daysUntil);
    scheduledDate.setHours(hours, minutes, 0, 0);

    return {
      id: generateNotificationId(habit.id, dayOfWeek),
      title: 'Habito Reminder',
      body: `Time to complete: ${habit.name}`,
      schedule: {
        at: scheduledDate,
        repeats: true,
        every: 'week'
      },
      sound: 'notification.wav',
      extra: {
        habitId: habit.id,
        habitName: habit.name
      }
    };
  });

  try {
    await LocalNotifications.schedule({ notifications });
    console.log(`Scheduled ${notifications.length} notifications for habit: ${habit.name}`);
  } catch (error) {
    console.error('Error scheduling notifications:', error);
  }
};

// Cancel all notifications for a specific habit
export const cancelHabitNotifications = async (habitId) => {
  if (!isNative) return;

  try {
    // Cancel notifications for all 7 days (0-6)
    const notificationIds = [0, 1, 2, 3, 4, 5, 6].map(day =>
      generateNotificationId(habitId, day)
    );

    await LocalNotifications.cancel({ notifications: notificationIds.map(id => ({ id })) });
  } catch (error) {
    console.error('Error canceling notifications:', error);
  }
};

// Schedule all notifications for user's habits
export const scheduleAllHabitNotifications = async (habits) => {
  if (!isNative) return;

  const permission = await checkNotificationPermission();
  if (permission !== 'granted') return;

  // Schedule notifications for each habit with a scheduled_time
  for (const habit of habits) {
    if (habit.scheduled_time) {
      await scheduleHabitNotifications(habit);
    }
  }
};

// Listen for notification actions
export const setupNotificationListeners = (onNotificationTap) => {
  if (!isNative) return () => {};

  const listener = LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (notification) => {
      const habitId = notification.notification.extra?.habitId;
      if (habitId && onNotificationTap) {
        onNotificationTap(habitId);
      }
    }
  );

  return () => listener.remove();
};
