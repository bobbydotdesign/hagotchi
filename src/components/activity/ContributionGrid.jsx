import React, { memo, useState, useCallback, useMemo } from 'react';
import {
  getColorForPercentage,
  formatDate,
  getMonthLabels,
  getDayLabels
} from '../../utils/activityUtils';

/**
 * Individual grid cell with tooltip
 */
const GridCell = memo(({ date, percentage, rawValue, isFuture, isToday, totalHabits }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const color = isFuture
    ? '#0d0d0d'
    : getColorForPercentage(percentage || 0);

  const borderColor = isToday ? '#00ff41' : 'transparent';

  const tooltipText = isFuture
    ? 'Future'
    : `${formatDate(date)}: ${Math.round((percentage || 0) * 100)}%`;

  return (
    <div
      style={{
        width: '12px',
        height: '12px',
        backgroundColor: color,
        borderRadius: '2px',
        cursor: isFuture ? 'default' : 'pointer',
        transition: 'transform 0.1s ease',
        border: `1px solid ${borderColor}`,
        position: 'relative',
        opacity: isFuture ? 0.3 : 1
      }}
      onMouseEnter={() => !isFuture && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title={tooltipText}
    >
      {showTooltip && !isFuture && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '6px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #00ff41',
          padding: '6px 10px',
          fontSize: '10px',
          color: '#00ff41',
          whiteSpace: 'nowrap',
          zIndex: 100,
          pointerEvents: 'none',
          borderRadius: '2px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
            {formatDate(date)}
          </div>
          <div style={{ color: '#888' }}>
            {Math.round((percentage || 0) * 100)}% complete
          </div>
          {/* Tooltip arrow */}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid #00ff41'
          }} />
        </div>
      )}
    </div>
  );
}, (prev, next) =>
  prev.date === next.date &&
  prev.percentage === next.percentage &&
  prev.isFuture === next.isFuture &&
  prev.isToday === next.isToday
);

/**
 * GitHub-style contribution grid
 * Horizontal layout: weeks as columns, days as rows
 */
const ContributionGrid = memo(({ weeks, period, totalHabits, isMobile }) => {
  const dayLabels = getDayLabels();
  const monthLabels = useMemo(() => getMonthLabels(weeks), [weeks]);

  // For year view, we may need horizontal scrolling
  const needsScroll = period === 'year' || period === 'all';

  return (
    <div style={{ width: '100%' }}>
      {/* Month labels row (for year/all views) */}
      {needsScroll && monthLabels.length > 0 && (
        <div style={{
          display: 'flex',
          marginLeft: '24px', // Align with grid (account for day labels)
          marginBottom: '4px',
          fontSize: '9px',
          color: '#666',
          overflow: 'hidden'
        }}>
          {monthLabels.map(({ month, weekIndex }, i) => (
            <div
              key={`${month}-${weekIndex}`}
              style={{
                position: 'relative',
                left: `${weekIndex * 14}px`, // 12px cell + 2px gap
                marginRight: i < monthLabels.length - 1
                  ? `${((monthLabels[i + 1]?.weekIndex || weekIndex) - weekIndex - 1) * 14}px`
                  : 0
              }}
            >
              {month}
            </div>
          ))}
        </div>
      )}

      {/* Grid container */}
      <div style={{
        display: 'flex',
        gap: '4px',
        overflowX: needsScroll ? 'auto' : 'visible',
        paddingBottom: needsScroll ? '8px' : 0
      }}>
        {/* Day labels column */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          flexShrink: 0
        }}>
          {dayLabels.map((day, i) => (
            <div
              key={i}
              style={{
                width: '16px',
                height: '12px',
                fontSize: '9px',
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: '4px'
              }}
            >
              {/* Only show every other label to avoid crowding */}
              {i % 2 === 1 ? day : ''}
            </div>
          ))}
        </div>

        {/* Week columns */}
        <div style={{
          display: 'flex',
          gap: '2px'
        }}>
          {weeks.map((week, weekIndex) => (
            <div
              key={weekIndex}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}
            >
              {week.map((day, dayIndex) => (
                <GridCell
                  key={day.date}
                  date={day.date}
                  percentage={day.percentage}
                  rawValue={day.rawValue}
                  isFuture={day.isFuture}
                  isToday={day.isToday}
                  totalHabits={totalHabits}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '4px',
        marginTop: '12px',
        fontSize: '10px',
        color: '#666'
      }}>
        <span>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((level, i) => (
          <div
            key={i}
            style={{
              width: '10px',
              height: '10px',
              backgroundColor: getColorForPercentage(level),
              borderRadius: '2px'
            }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
});

ContributionGrid.displayName = 'ContributionGrid';

export default ContributionGrid;
