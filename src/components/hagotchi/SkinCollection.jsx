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
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
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
                  padding: '12px',
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
                }}
              >
                {/* Active indicator */}
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    fontSize: '8px',
                    color: '#00ff41',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    active
                  </div>
                )}

                {/* Skin Name */}
                <div style={{
                  fontSize: '11px',
                  color: isUnlocked ? '#fff' : '#666',
                  marginBottom: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {isUnlocked ? skin.name : '???'}
                </div>

                {/* Rarity */}
                <div style={{
                  fontSize: '8px',
                  color: isUnlocked ? getRarityColor(skin.rarity) : '#444',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                }}>
                  [{skin.rarity}]
                </div>

                {/* ASCII Preview */}
                <div style={{
                  fontFamily: 'IBM Plex Mono, Fira Code, SF Mono, monospace',
                  fontSize: '8px',
                  lineHeight: 1.1,
                  color: isUnlocked ? '#00ff41' : '#333',
                  whiteSpace: 'pre',
                  textAlign: 'center',
                  minHeight: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {isUnlocked ? (
                    <div>
                      {skin.art.content.slice(0, 4).map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#444' }}>
                      [ ? ? ]<br />
                      [ ? ? ]
                    </div>
                  )}
                </div>

                {/* Unlock requirement */}
                {!isUnlocked && milestone && (
                  <div style={{
                    fontSize: '8px',
                    color: '#555',
                    marginTop: '8px',
                    textAlign: 'center',
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
          }}>
            {/* Skin Info */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
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
              fontSize: '11px',
              color: '#888',
              lineHeight: 1.6,
              margin: '0 0 16px 0',
              fontStyle: 'italic',
            }}>
              "{selectedSkin.loreText}"
            </p>

            {/* Select Button */}
            {activeSkinId !== selectedSkin.id && (
              <button
                onClick={handleSelectActive}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#00ff41',
                  border: 'none',
                  color: '#000',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                }}
              >
                Set as Active
              </button>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

export default SkinCollection;
