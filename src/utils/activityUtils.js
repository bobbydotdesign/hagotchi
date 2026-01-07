/**
 * Activity calculation utilities for GitHub-style contribution grid
 */

// Terminal green color scale (matching the retro aesthetic)
const COLOR_LEVELS = {
  0: '#161b22',    // No completions - dark gray
  1: '#0e4429',    // 1-25% - very dark green
  2: '#006d32',    // 26-50% - dark green
  3: '#26a641',    // 51-75% - medium green
  4: '#39d353'     // 76-100% - bright green (close to #00ff41)
};

/**
 * Get color based on completion percentage
 * @param {number} percentage - 0 to 1 (or 0 to 100 if already percentage)
 * @returns {string} - hex color
 */
export const getColorForPercentage = (percentage) => {
  // Normalize to 0-1 range
  const pct = percentage > 1 ? percentage / 100 : percentage;

  if (pct === 0) return COLOR_LEVELS[0];
  if (pct <= 0.25) return COLOR_LEVELS[1];
  if (pct <= 0.50) return COLOR_LEVELS[2];
  if (pct <= 0.75) return COLOR_LEVELS[3];
  return COLOR_LEVELS[4];
};

/**
 * Get the intensity level (0-4) for a percentage
 * Useful for tooltips and accessibility
 */
export const getIntensityLevel = (percentage) => {
  const pct = percentage > 1 ? percentage / 100 : percentage;

  if (pct === 0) return 0;
  if (pct <= 0.25) return 1;
  if (pct <= 0.50) return 2;
  if (pct <= 0.75) return 3;
  return 4;
};

/**
 * Generate grid data for the contribution grid
 * Returns an array of weeks, each containing 7 days
 *
 * @param {Object} activityData - Data from useActivityData hook
 * @param {string} period - 'week', 'month', 'year', or 'all'
 * @param {number} totalHabits - Total number of habits for percentage calculation
 * @returns {Array} - Array of week arrays containing day objects
 */
export const generateGridData = (activityData, period, totalHabits) => {
  const { byDate = {} } = activityData || {};

  const endDate = new Date();
  const startDate = new Date();

  // Calculate weeks to show based on period
  let weeksToShow;
  switch (period) {
    case 'week':
      weeksToShow = 1;
      break;
    case 'month':
      weeksToShow = 5; // ~35 days
      break;
    case 'year':
      weeksToShow = 53;
      break;
    case 'all':
      weeksToShow = 104; // ~2 years
      break;
    default:
      weeksToShow = 5;
  }

  // Align end date to end of week (Saturday)
  const endDayOfWeek = endDate.getDay();
  endDate.setDate(endDate.getDate() + (6 - endDayOfWeek));

  // Calculate start date
  startDate.setDate(endDate.getDate() - (weeksToShow * 7) + 1);

  // Generate all dates
  const weeks = [];
  const current = new Date(startDate);

  for (let w = 0; w < weeksToShow; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = current.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      const isFuture = dateStr > today;

      // Get completion value for this date
      const rawValue = byDate[dateStr] || 0;
      // Calculate percentage based on total habits
      const percentage = totalHabits > 0 ? Math.min(rawValue / totalHabits, 1) : 0;

      week.push({
        date: dateStr,
        percentage: isFuture ? null : percentage,
        rawValue: isFuture ? null : rawValue,
        isFuture,
        isToday: dateStr === today
      });

      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
};

/**
 * Calculate activity statistics
 * @param {Object} activityData - Data from useActivityData hook
 * @param {number} totalHabits - Total number of habits
 * @returns {Object} - Stats object
 */
export const calculateActivityStats = (activityData, totalHabits) => {
  const { byDate = {}, raw = [] } = activityData || {};

  const dates = Object.keys(byDate).sort();

  if (dates.length === 0) {
    return {
      totalDays: 0,
      activeDays: 0,
      currentStreak: 0,
      longestStreak: 0,
      averageCompletion: 0,
      totalCompletions: 0
    };
  }

  // Calculate active days (days with any completion)
  const activeDays = dates.filter(d => byDate[d] > 0).length;

  // Calculate total completions
  const totalCompletions = raw.length;

  // Calculate average completion percentage
  let totalPct = 0;
  dates.forEach(d => {
    if (byDate[d] > 0 && totalHabits > 0) {
      totalPct += Math.min(byDate[d] / totalHabits, 1);
    }
  });
  const averageCompletion = activeDays > 0 ? Math.round((totalPct / activeDays) * 100) : 0;

  // Calculate streaks
  const today = new Date().toISOString().split('T')[0];
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Check from today backwards for current streak
  const checkDate = new Date();
  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    const hasCompletion = byDate[dateStr] && byDate[dateStr] >= totalHabits * 0.5; // 50%+ counts as active

    if (hasCompletion) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }

    // Safety limit
    if (currentStreak > 365) break;
  }

  // Calculate longest streak
  dates.sort();
  dates.forEach(d => {
    const hasCompletion = byDate[d] && byDate[d] >= totalHabits * 0.5;
    if (hasCompletion) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  });

  return {
    totalDays: dates.length,
    activeDays,
    currentStreak,
    longestStreak,
    averageCompletion,
    totalCompletions
  };
};

/**
 * Format a date for display
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @returns {string} - Formatted date
 */
export const formatDate = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Get month labels for the grid
 * @param {Array} weeks - Array of week data
 * @returns {Array} - Array of { month, weekIndex } for labels
 */
export const getMonthLabels = (weeks) => {
  const labels = [];
  let lastMonth = null;

  weeks.forEach((week, weekIndex) => {
    // Use the first day of the week to determine month
    const firstDay = week[0];
    if (firstDay) {
      const date = new Date(firstDay.date + 'T00:00:00');
      const month = date.toLocaleDateString('en-US', { month: 'short' });

      if (month !== lastMonth) {
        labels.push({ month, weekIndex });
        lastMonth = month;
      }
    }
  });

  return labels;
};

/**
 * Get day labels (Mon, Tue, etc.)
 * @returns {Array} - Array of day abbreviations
 */
export const getDayLabels = () => ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
