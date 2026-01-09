import React, { useState, useEffect } from 'react';
import { getVitalityState, getVitalityStateLabel, getRarityColor } from '../../data/hagotchiSkins';

const HagotchiCompanion = ({
  skin,
  vitality,
  isMobile,
  onTap,
  feeding = false,
  vitalityGain = 0
}) => {
  const [animationFrame, setAnimationFrame] = useState(0);
  const [showVitalityPop, setShowVitalityPop] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);

  // Animation loop for idle bouncing
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationFrame(prev => (prev + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Show vitality gain popup when feeding
  useEffect(() => {
    if (feeding && vitalityGain > 0) {
      setShowVitalityPop(true);
      const timer = setTimeout(() => setShowVitalityPop(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [feeding, vitalityGain]);

  // Wake up animation when vitality goes from dormant to higher
  useEffect(() => {
    if (vitality > 19 && getVitalityState(vitality - vitalityGain) === 'dormant') {
      setIsWakingUp(true);
      const timer = setTimeout(() => setIsWakingUp(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [vitality, vitalityGain]);

  if (!skin) return null;

  const vitalityState = getVitalityState(vitality);
  const stateLabel = getVitalityStateLabel(vitality);
  const art = skin.art[vitalityState] || skin.art.content;

  // Animation offset for bouncing effect (only when thriving/content)
  const bounceOffset = (vitalityState === 'thriving' || vitalityState === 'content')
    ? Math.sin(animationFrame * Math.PI / 2) * 2
    : 0;

  // Get state color
  const getStateColor = () => {
    switch (vitalityState) {
      case 'thriving': return '#00ff41';
      case 'content': return '#00ff41';
      case 'tired': return '#ffaa00';
      case 'dormant': return '#666';
      default: return '#00ff41';
    }
  };

  return (
    <div
      onClick={onTap}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: isMobile ? '16px 12px' : '20px 16px',
        backgroundColor: 'rgba(0, 255, 65, 0.02)',
        border: '1px solid #222',
        cursor: onTap ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        transition: 'background-color 0.2s ease',
      }}
    >
      {/* Skin Name and Rarity */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
      }}>
        <span style={{
          fontSize: isMobile ? '11px' : '10px',
          color: '#888',
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}>
          {skin.name}
        </span>
        <span style={{
          fontSize: '8px',
          color: getRarityColor(skin.rarity),
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          [{skin.rarity}]
        </span>
      </div>

      {/* ASCII Art Character */}
      <div
        style={{
          fontFamily: 'IBM Plex Mono, Fira Code, SF Mono, monospace',
          fontSize: isMobile ? '14px' : '12px',
          lineHeight: 1.2,
          color: getStateColor(),
          textShadow: vitalityState === 'thriving' ? '0 0 8px rgba(0, 255, 65, 0.5)' : 'none',
          transform: `translateY(${-bounceOffset}px)`,
          transition: isWakingUp ? 'all 0.5s ease' : 'transform 0.3s ease',
          whiteSpace: 'pre',
          textAlign: 'center',
          opacity: isWakingUp ? [0.5, 1, 0.5, 1][animationFrame] : 1,
        }}
      >
        {art.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>

      {/* Vitality Gain Popup */}
      {showVitalityPop && (
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#00ff41',
            fontSize: isMobile ? '16px' : '14px',
            fontWeight: 'bold',
            textShadow: '0 0 10px rgba(0, 255, 65, 0.8)',
            animation: 'floatUp 1.5s ease-out forwards',
          }}
        >
          +{vitalityGain}
        </div>
      )}

      {/* State Label */}
      <div style={{
        marginTop: '12px',
        fontSize: isMobile ? '10px' : '9px',
        color: getStateColor(),
        letterSpacing: '1px',
        textTransform: 'uppercase',
      }}>
        {stateLabel}
      </div>

      {/* Vitality Bar */}
      <div style={{
        marginTop: '8px',
        width: '100%',
        maxWidth: '200px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
      }}>
        <div style={{
          width: '100%',
          height: '6px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${vitality}%`,
              backgroundColor: getStateColor(),
              boxShadow: vitalityState === 'thriving' ? '0 0 8px rgba(0, 255, 65, 0.5)' : 'none',
              transition: 'width 0.5s ease, background-color 0.3s ease',
            }}
          />
        </div>
        <span style={{
          fontSize: '9px',
          color: '#666',
        }}>
          {vitality}/100 vitality
        </span>
      </div>

      {/* CSS Keyframes for animation */}
      <style>
        {`
          @keyframes floatUp {
            0% {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
            100% {
              opacity: 0;
              transform: translateX(-50%) translateY(-30px);
            }
          }
        `}
      </style>
    </div>
  );
};

export default HagotchiCompanion;
