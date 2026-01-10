import React from 'react';
import { SKINS, getRarityColor } from '../../data/hagotchiSkins';
import BottomSheet from '../BottomSheet';

const LoreArchive = ({
  isOpen,
  onClose,
  unlockedSkinIds,
  isMobile
}) => {
  const unlockedSkins = SKINS.filter(s => unlockedSkinIds.includes(s.id));

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="LORE ARCHIVE"
      isMobile={isMobile}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {/* Intro text */}
        <p style={{
          fontSize: '11px',
          color: '#666',
          lineHeight: 1.6,
          margin: 0,
          textAlign: 'center',
          fontStyle: 'italic',
        }}>
          The stories of your companions, collected through your journey of growth.
        </p>

        {/* Lore entries */}
        {unlockedSkins.length === 0 ? (
          <div style={{
            padding: '24px',
            textAlign: 'center',
            color: '#666',
            fontSize: '12px',
          }}>
            No lore entries yet. Complete habits to unlock new companions!
          </div>
        ) : (
          unlockedSkins.map((skin, index) => (
            <div
              key={skin.id}
              style={{
                padding: '16px',
                backgroundColor: 'rgba(0, 255, 65, 0.02)',
                border: '1px solid #222',
                position: 'relative',
              }}
            >
              {/* Entry number */}
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                fontSize: '9px',
                color: '#444',
              }}>
                #{String(index + 1).padStart(2, '0')}
              </div>

              {/* Skin header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '12px',
              }}>
                {/* Character image */}
                <img
                  src={skin.image}
                  alt={skin.name}
                  style={{
                    width: '40px',
                    height: '40px',
                    imageRendering: 'pixelated',
                  }}
                />

                <div>
                  <div style={{
                    fontSize: '13px',
                    color: '#fff',
                  }}>
                    {skin.name}
                  </div>
                  <div style={{
                    fontSize: '9px',
                    color: getRarityColor(skin.rarity),
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    {skin.rarity}
                  </div>
                </div>
              </div>

              {/* Lore text */}
              <p style={{
                fontSize: '14px',
                color: '#999',
                lineHeight: 1.6,
                margin: 0,
              }}>
                {skin.loreText}
              </p>
            </div>
          ))
        )}

        {/* Locked entries teaser */}
        {unlockedSkins.length < SKINS.length && (
          <div style={{
            padding: '16px',
            textAlign: 'center',
            color: '#444',
            fontSize: '10px',
            borderTop: '1px solid #222',
          }}>
            {SKINS.length - unlockedSkins.length} more {SKINS.length - unlockedSkins.length === 1 ? 'story' : 'stories'} to discover...
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

export default LoreArchive;
