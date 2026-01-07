import React, { useState, useMemo } from 'react';
import { useActivityData } from '../../hooks/useActivityData';
import { generateGridData, calculateActivityStats } from '../../utils/activityUtils';
import ContributionGrid from './ContributionGrid';

/**
 * ActivityView - GitHub-style activity tracking view
 * Replaces the Week and Stats tabs with a unified activity view
 */
const ActivityView = ({ userId, habits, isMobile, cursorBlink }) => {
  const [timePeriod, setTimePeriod] = useState('month');

  // Fetch activity data
  const { data: activityData, loading, error, refetch } = useActivityData(userId, timePeriod);

  // Generate grid data
  const gridData = useMemo(() =>
    generateGridData(activityData, timePeriod, habits.length),
    [activityData, timePeriod, habits.length]
  );

  // Calculate stats
  const stats = useMemo(() =>
    calculateActivityStats(activityData, habits.length),
    [activityData, habits.length]
  );

  const periods = [
    { key: 'week', label: 'W', fullLabel: 'Week' },
    { key: 'month', label: 'M', fullLabel: 'Month' },
    { key: 'year', label: 'Y', fullLabel: 'Year' },
    { key: 'all', label: '∞', fullLabel: 'All' }
  ];

  return (
    <div style={{ marginTop: '24px' }}>
      {/* Main activity container */}
      <div style={{
        border: '1px solid #333',
        backgroundColor: '#0d0d0d'
      }}>
        {/* Header with period selector */}
        <div style={{
          borderBottom: '1px solid #333',
          padding: '8px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{
            fontSize: '11px',
            color: '#666',
            letterSpacing: '1px'
          }}>
            {isMobile ? 'ACTIVITY' : '┌─ ACTIVITY ─┐'}
          </span>

          {/* Period selector */}
          <div style={{ display: 'flex', gap: '2px' }}>
            {periods.map(({ key, label, fullLabel }) => (
              <button
                key={key}
                onClick={() => setTimePeriod(key)}
                title={fullLabel}
                style={{
                  background: timePeriod === key ? '#1a1a1a' : 'transparent',
                  border: '1px solid #333',
                  color: timePeriod === key ? '#00ff41' : '#666',
                  padding: isMobile ? '4px 8px' : '4px 10px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '10px',
                  letterSpacing: '0.5px',
                  transition: 'all 0.15s'
                }}
              >
                {isMobile ? label : `[${fullLabel.toUpperCase()}]`}
              </button>
            ))}
          </div>
        </div>

        {/* Grid content */}
        <div style={{ padding: isMobile ? '12px' : '16px' }}>
          {loading && !activityData ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#00ff41',
              fontSize: '12px'
            }}>
              loading activity data...
            </div>
          ) : error ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#ff4444',
              fontSize: '12px'
            }}>
              error loading activity: {error}
              <br />
              <button
                onClick={refetch}
                style={{
                  marginTop: '12px',
                  background: 'transparent',
                  border: '1px solid #ff4444',
                  color: '#ff4444',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'inherit'
                }}
              >
                retry
              </button>
            </div>
          ) : (
            <ContributionGrid
              weeks={gridData}
              period={timePeriod}
              totalHabits={habits.length}
              isMobile={isMobile}
            />
          )}
        </div>
      </div>

      {/* Stats panel */}
      <div style={{
        marginTop: '16px',
        border: '1px solid #333',
        backgroundColor: '#0d0d0d'
      }}>
        <div style={{
          borderBottom: '1px solid #333',
          padding: '8px 12px',
          fontSize: '11px',
          color: '#666',
          letterSpacing: '1px'
        }}>
          {isMobile ? 'STATS' : '┌─ ANALYTICS ─┐'}
        </div>

        <div style={{
          padding: isMobile ? '12px' : '16px',
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: isMobile ? '12px' : '16px'
        }}>
          {/* Current Streak */}
          <div>
            <div style={{
              color: '#666',
              fontSize: '10px',
              marginBottom: '4px',
              letterSpacing: '0.5px'
            }}>
              CURRENT STREAK
            </div>
            <div style={{
              color: stats.currentStreak > 0 ? '#00ff41' : '#888',
              fontSize: isMobile ? '20px' : '24px',
              fontWeight: 'bold',
              textShadow: stats.currentStreak > 7 ? '0 0 10px #00ff41' : 'none'
            }}>
              {stats.currentStreak} <span style={{ fontSize: '14px' }}>days</span>
              {stats.currentStreak > 0 && ' 🔥'}
            </div>
          </div>

          {/* Longest Streak */}
          <div>
            <div style={{
              color: '#666',
              fontSize: '10px',
              marginBottom: '4px',
              letterSpacing: '0.5px'
            }}>
              LONGEST STREAK
            </div>
            <div style={{
              color: '#ffaa00',
              fontSize: isMobile ? '20px' : '24px',
              fontWeight: 'bold'
            }}>
              {stats.longestStreak} <span style={{ fontSize: '14px' }}>days</span>
            </div>
          </div>

          {/* Active Days */}
          <div>
            <div style={{
              color: '#666',
              fontSize: '10px',
              marginBottom: '4px',
              letterSpacing: '0.5px'
            }}>
              ACTIVE DAYS
            </div>
            <div style={{
              color: '#fff',
              fontSize: isMobile ? '20px' : '24px',
              fontWeight: 'bold'
            }}>
              {stats.activeDays}
              <span style={{ color: '#666', fontSize: '14px' }}>
                /{stats.totalDays || gridData.length * 7}
              </span>
            </div>
          </div>

          {/* Average Completion */}
          <div>
            <div style={{
              color: '#666',
              fontSize: '10px',
              marginBottom: '4px',
              letterSpacing: '0.5px'
            }}>
              AVG COMPLETION
            </div>
            <div style={{
              color: stats.averageCompletion >= 75 ? '#00ff41' :
                     stats.averageCompletion >= 50 ? '#ffaa00' : '#888',
              fontSize: isMobile ? '20px' : '24px',
              fontWeight: 'bold'
            }}>
              {stats.averageCompletion}%
            </div>
          </div>
        </div>

        {/* Total habits indicator */}
        <div style={{
          borderTop: '1px solid #222',
          padding: '8px 12px',
          fontSize: '10px',
          color: '#444',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>tracking {habits.length} habit{habits.length !== 1 ? 's' : ''}</span>
          <span>{stats.totalCompletions} total completions</span>
        </div>
      </div>
    </div>
  );
};

export default ActivityView;
