import React, { useState } from 'react';
import { SKINS, UNLOCK_MILESTONES, getRarityColor } from '../../data/hagotchiSkins';
import BottomSheet from '../BottomSheet';

const SkinCollection = ({
  isOpen,
  onClose,
  unlockedSkinIds,
  activeSkinId,
  onSelectSkin,
  isMobile
}) => {
  const [selectedSkin, setSelectedSkin] = useState(null);

  const handleSkinClick = (skin) => {
    if (unlockedSkinIds.includes(skin.id)) {
      setSelectedSkin(skin);
    }
  };

  const handleSelectActive = () => {
    if (selectedSkin && unlockedSkinIds.includes(selectedSkin.id)) {
      onSelectSkin(selectedSkin.id);
      setSelectedSkin(null);
    }
  };

  const getMilestoneForSkin = (skinId) => {
    return UNLOCK_MILESTONES.find(m => m.skinId === skinId);
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => {
        setSelectedSkin(null);
        onClose();
      }}
      title="SKIN COLLECTION"
      isMobile={isMobile}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {/* Stats */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          padding: '12px',
          backgroundColor: 'rgba(0, 255, 65, 0.02)',
          border: '1px solid #222',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', color: '#00ff41', fontWeight: 'bold' }}>
              {unlockedSkinIds.length}
            </div>
            <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Unlocked
            </div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#333' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', color: '#666', fontWeight: 'bold' }}>
              {SKINS.length - unlockedSkinIds.length}
            </div>
            <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Locked
            </div>
          </div>
        </div>

        {/* Skin Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
        }}>
          {SKINS.map(skin => {
            const isUnlocked = unlockedSkinIds.includes(skin.id);
            const isActive = activeSkinId === skin.id;
            const isSelected = selectedSkin?.id === skin.id;
            const milestone = getMilestoneForSkin(skin.id);

            return (
              <div
                key={skin.id}
                onClick={() => handleSkinClick(skin)}
                style={{
                  padding: '10px',
                  backgroundColor: isSelected
                    ? 'rgba(0, 255, 65, 0.1)'
                    : isUnlocked
                      ? 'rgba(0, 255, 65, 0.02)'
                      : '#0d0d0d',
                  border: `1px solid ${isSelected ? '#00ff41' : isActive ? '#00ff41' : '#222'}`,
                  cursor: isUnlocked ? 'pointer' : 'default',
                  opacity: isUnlocked ? 1 : 0.5,
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                {/* Active indicator */}
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    fontSize: '7px',
                    color: '#00ff41',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    ●
                  </div>
                )}

                {/* Character Image */}
                <div style={{
                  width: '48px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '8px',
                }}>
                  {isUnlocked ? (
                    <img
                      src={skin.image}
                      alt={skin.name}
                      style={{
                        width: '48px',
                        height: '48px',
                        imageRendering: 'pixelated',
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '48px',
                      height: '48px',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#444',
                      fontSize: '20px',
                    }}>
                      ?
                    </div>
                  )}
                </div>

                {/* Skin Name */}
                <div style={{
                  fontSize: '9px',
                  color: isUnlocked ? '#fff' : '#666',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  width: '100%',
                }}>
                  {isUnlocked ? skin.name : '???'}
                </div>

                {/* Rarity dot */}
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: isUnlocked ? getRarityColor(skin.rarity) : '#333',
                  marginTop: '4px',
                }} />

                {/* Unlock requirement tooltip on hover - shown below */}
                {!isUnlocked && milestone && (
                  <div style={{
                    fontSize: '7px',
                    color: '#555',
                    marginTop: '6px',
                    textAlign: 'center',
                    lineHeight: 1.3,
                  }}>
                    {milestone.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Skin Detail */}
        {selectedSkin && (
          <div style={{
            padding: '16px',
            backgroundColor: 'rgba(0, 255, 65, 0.02)',
            border: '1px solid #333',
            display: 'flex',
            gap: '16px',
            alignItems: 'flex-start',
          }}>
            {/* Large character image */}
            <img
              src={selectedSkin.image}
              alt={selectedSkin.name}
              style={{
                width: '64px',
                height: '64px',
                imageRendering: 'pixelated',
                flexShrink: 0,
              }}
            />

            <div style={{ flex: 1 }}>
              {/* Skin Info */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              }}>
                <span style={{
                  fontSize: '14px',
                  color: '#fff',
                }}>
                  {selectedSkin.name}
                </span>
                <span style={{
                  fontSize: '9px',
                  color: getRarityColor(selectedSkin.rarity),
                  textTransform: 'uppercase',
                }}>
                  [{selectedSkin.rarity}]
                </span>
              </div>

              {/* Lore Text */}
              <p style={{
                fontSize: '10px',
                color: '#888',
                lineHeight: 1.5,
                margin: '0 0 12px 0',
                fontStyle: 'italic',
              }}>
                "{selectedSkin.loreText}"
              </p>

              {/* Select Button */}
              {activeSkinId !== selectedSkin.id && (
                <button
                  onClick={handleSelectActive}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#00ff41',
                    border: 'none',
                    color: '#000',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}
                >
                  Set as Active
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

export default SkinCollection;
