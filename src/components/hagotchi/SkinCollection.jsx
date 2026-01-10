import React, { useState } from 'react';
import { SKINS, getRarityColor } from '../../data/hagotchiSkins';
import BottomSheet from '../BottomSheet';

const SkinCollection = ({
  isOpen,
  onClose,
  unlockedSkinIds,
  activeSkinId,
  onSelectSkin,
  onSetCustomName,
  getStatsForSkin,
  isMobile
}) => {
  const [selectedSkin, setSelectedSkin] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [customNameInput, setCustomNameInput] = useState('');

  const handleSkinClick = (skin) => {
    if (unlockedSkinIds.includes(skin.id)) {
      setSelectedSkin(skin);
      setIsEditingName(false);
      // Load existing custom name if any
      const stats = getStatsForSkin?.(skin.id);
      setCustomNameInput(stats?.custom_name || '');
    }
  };

  const handleSelectActive = () => {
    if (selectedSkin && unlockedSkinIds.includes(selectedSkin.id)) {
      onSelectSkin(selectedSkin.id);
      setSelectedSkin(null);
    }
  };

  const handleEditName = () => {
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    if (selectedSkin && onSetCustomName) {
      const trimmedName = customNameInput.trim();
      onSetCustomName(selectedSkin.id, trimmedName || null);
    }
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    const stats = getStatsForSkin?.(selectedSkin?.id);
    setCustomNameInput(stats?.custom_name || '');
    setIsEditingName(false);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => {
        setSelectedSkin(null);
        setIsEditingName(false);
        onClose();
      }}
      title="HAGOTCHI COLLECTION"
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
              Mystery
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
            const stats = getStatsForSkin?.(skin.id);
            const displayName = stats?.custom_name || skin.name;

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
                  <img
                    src={skin.image}
                    alt={isUnlocked ? displayName : skin.name}
                    style={{
                      width: '48px',
                      height: '48px',
                      imageRendering: 'pixelated',
                      filter: isUnlocked ? 'none' : 'grayscale(100%) brightness(0.3)',
                      opacity: isUnlocked ? 1 : 0.5,
                    }}
                  />
                </div>

                {/* Skin Name */}
                <div style={{
                  fontSize: '9px',
                  color: isUnlocked ? '#fff' : '#444',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  width: '100%',
                }}>
                  {isUnlocked ? displayName : skin.name}
                </div>

                {/* Rarity dot */}
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: isUnlocked ? getRarityColor(skin.rarity) : '#333',
                  marginTop: '4px',
                }} />
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
            <div style={{
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
                {/* Skin Info / Name Edit */}
                {isEditingName ? (
                  <div style={{ marginBottom: '8px' }}>
                    <input
                      type="text"
                      value={customNameInput}
                      onChange={(e) => setCustomNameInput(e.target.value.slice(0, 20))}
                      placeholder={selectedSkin.name}
                      maxLength={20}
                      autoFocus={!isMobile}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #00ff41',
                        color: '#fff',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                        outline: 'none',
                      }}
                    />
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      marginTop: '8px',
                    }}>
                      <button
                        onClick={handleSaveName}
                        style={{
                          padding: '4px 12px',
                          backgroundColor: '#00ff41',
                          border: 'none',
                          color: '#000',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        style={{
                          padding: '4px 12px',
                          backgroundColor: 'transparent',
                          border: '1px solid #444',
                          color: '#888',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: '9px',
                          textTransform: 'uppercase',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
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
                      {getStatsForSkin?.(selectedSkin.id)?.custom_name || selectedSkin.name}
                    </span>
                    <span style={{
                      fontSize: '9px',
                      color: getRarityColor(selectedSkin.rarity),
                      textTransform: 'uppercase',
                    }}>
                      [{selectedSkin.rarity}]
                    </span>
                    <button
                      onClick={handleEditName}
                      style={{
                        marginLeft: 'auto',
                        padding: '2px 6px',
                        backgroundColor: 'transparent',
                        border: '1px solid #444',
                        color: '#666',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: '8px',
                        textTransform: 'uppercase',
                      }}
                    >
                      Rename
                    </button>
                  </div>
                )}

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

                {/* Per-Hagotchi Stats */}
                {getStatsForSkin && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '8px',
                    padding: '8px',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #222',
                    marginBottom: '12px',
                  }}>
                    {(() => {
                      const stats = getStatsForSkin(selectedSkin.id);
                      return (
                        <>
                          <div>
                            <div style={{ fontSize: '8px', color: '#666', textTransform: 'uppercase' }}>
                              Discovered
                            </div>
                            <div style={{ fontSize: '11px', color: '#888' }}>
                              {formatDate(stats?.discovered_at)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '8px', color: '#666', textTransform: 'uppercase' }}>
                              Days Active
                            </div>
                            <div style={{ fontSize: '11px', color: '#888' }}>
                              {stats?.total_days_active || 0}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '8px', color: '#666', textTransform: 'uppercase' }}>
                              Habits Done
                            </div>
                            <div style={{ fontSize: '11px', color: '#888' }}>
                              {stats?.habits_completed_while_active || 0}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '8px', color: '#666', textTransform: 'uppercase' }}>
                              Best Streak
                            </div>
                            <div style={{ fontSize: '11px', color: '#888' }}>
                              {stats?.longest_streak_while_active || 0} days
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

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
          </div>
        )}

        {/* Mystery Collection Tease */}
        {SKINS.length - unlockedSkinIds.length > 0 && (
          <div style={{
            textAlign: 'center',
            padding: '12px',
            fontSize: '10px',
            color: '#555',
            fontStyle: 'italic',
          }}>
            {SKINS.length - unlockedSkinIds.length} mystery Hagotchi{SKINS.length - unlockedSkinIds.length > 1 ? 's' : ''} waiting to be discovered...
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

export default SkinCollection;
