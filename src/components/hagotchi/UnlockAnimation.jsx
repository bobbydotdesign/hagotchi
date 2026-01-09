import React, { useState, useEffect } from 'react';
import { getSkinById, getRarityColor, SKINS } from '../../data/hagotchiSkins';
import { hapticSuccess, hapticHeavy } from '../../services/haptics';

const UnlockAnimation = ({
  skinId,
  isOpen,
  onClose,
  isMobile
}) => {
  const [phase, setPhase] = useState('spinning'); // spinning, revealing, revealed
  const [spinIndex, setSpinIndex] = useState(0);
  const [spinSpeed, setSpinSpeed] = useState(50);

  const unlockedSkin = getSkinById(skinId);

  // Spin animation
  useEffect(() => {
    if (!isOpen || phase !== 'spinning') return;

    // Gradually slow down the spin
    const spinTimer = setTimeout(() => {
      setSpinIndex(prev => (prev + 1) % SKINS.length);

      // Slow down over time
      setSpinSpeed(prev => {
        const newSpeed = prev * 1.1;
        if (newSpeed > 400) {
          // Stop on the correct skin
          const targetIndex = SKINS.findIndex(s => s.id === skinId);
          setSpinIndex(targetIndex);
          setPhase('revealing');
          return prev;
        }
        return newSpeed;
      });
    }, spinSpeed);

    return () => clearTimeout(spinTimer);
  }, [isOpen, phase, spinIndex, spinSpeed, skinId]);

  // Reveal animation
  useEffect(() => {
    if (phase !== 'revealing') return;

    hapticHeavy();

    const revealTimer = setTimeout(() => {
      setPhase('revealed');
      hapticSuccess();
    }, 800);

    return () => clearTimeout(revealTimer);
  }, [phase]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setPhase('spinning');
      setSpinIndex(0);
      setSpinSpeed(50);
    }
  }, [isOpen]);

  if (!isOpen || !unlockedSkin) return null;

  const currentDisplaySkin = phase === 'spinning'
    ? SKINS[spinIndex]
    : unlockedSkin;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      {/* Title */}
      <div style={{
        fontSize: isMobile ? '14px' : '12px',
        color: '#00ff41',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        marginBottom: '24px',
        textShadow: '0 0 10px rgba(0, 255, 65, 0.5)',
        animation: phase === 'revealed' ? 'pulse 1s ease-in-out infinite' : 'none',
      }}>
        {phase === 'spinning' ? 'Unlocking...' : phase === 'revealing' ? 'New Form!' : 'Form Unlocked!'}
      </div>

      {/* Skin Display Container */}
      <div style={{
        padding: '24px',
        backgroundColor: 'rgba(0, 255, 65, 0.02)',
        border: `2px solid ${phase === 'revealed' ? getRarityColor(unlockedSkin.rarity) : '#333'}`,
        borderRadius: '4px',
        minWidth: isMobile ? '200px' : '180px',
        textAlign: 'center',
        boxShadow: phase === 'revealed'
          ? `0 0 30px ${getRarityColor(unlockedSkin.rarity)}40`
          : 'none',
        transition: 'all 0.5s ease',
      }}>
        {/* Skin Name */}
        <div style={{
          fontSize: isMobile ? '16px' : '14px',
          color: phase === 'revealed' ? '#fff' : '#666',
          marginBottom: '4px',
          transition: 'color 0.3s ease',
        }}>
          {phase === 'spinning' ? '???' : currentDisplaySkin.name}
        </div>

        {/* Rarity */}
        <div style={{
          fontSize: '10px',
          color: phase === 'revealed' ? getRarityColor(unlockedSkin.rarity) : '#444',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '16px',
        }}>
          [{currentDisplaySkin.rarity}]
        </div>

        {/* ASCII Art */}
        <div style={{
          fontFamily: 'IBM Plex Mono, Fira Code, SF Mono, monospace',
          fontSize: isMobile ? '14px' : '12px',
          lineHeight: 1.2,
          color: phase === 'revealed' ? '#00ff41' : '#444',
          textShadow: phase === 'revealed' ? '0 0 8px rgba(0, 255, 65, 0.5)' : 'none',
          whiteSpace: 'pre',
          transition: 'all 0.5s ease',
          minHeight: '80px',
        }}>
          {phase === 'spinning' ? (
            // Show cycling skins during spin
            currentDisplaySkin.art.content.map((line, i) => (
              <div key={i} style={{ opacity: 0.5 }}>{line}</div>
            ))
          ) : (
            // Show the actual unlocked skin
            currentDisplaySkin.art.thriving.map((line, i) => (
              <div key={i}>{line}</div>
            ))
          )}
        </div>
      </div>

      {/* Lore Text (only shown when revealed) */}
      {phase === 'revealed' && (
        <div style={{
          maxWidth: '300px',
          marginTop: '24px',
          padding: '16px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          border: '1px solid #333',
          animation: 'fadeIn 0.5s ease-out',
        }}>
          <p style={{
            fontSize: isMobile ? '12px' : '11px',
            color: '#888',
            lineHeight: 1.6,
            margin: 0,
            fontStyle: 'italic',
            textAlign: 'center',
          }}>
            "{unlockedSkin.loreText}"
          </p>
        </div>
      )}

      {/* Continue Button (only shown when revealed) */}
      {phase === 'revealed' && (
        <button
          onClick={onClose}
          style={{
            marginTop: '24px',
            padding: '12px 32px',
            backgroundColor: '#00ff41',
            border: 'none',
            color: '#000',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: isMobile ? '12px' : '11px',
            fontWeight: 'bold',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            animation: 'fadeIn 0.5s ease-out',
          }}
        >
          Continue
        </button>
      )}

      {/* CSS Keyframes */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
};

export default UnlockAnimation;
