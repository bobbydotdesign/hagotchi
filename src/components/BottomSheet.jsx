import React, { useEffect, useState } from 'react';

/**
 * BottomSheet Component
 *
 * A reusable modal that displays as a bottom sheet on mobile
 * and a centered modal on desktop. Includes terminal-style aesthetics.
 *
 * @param {boolean} isOpen - Controls visibility
 * @param {function} onClose - Callback when sheet is closed
 * @param {string} title - Title displayed in header (without > prefix)
 * @param {React.ReactNode} children - Content to render inside
 * @param {boolean} isMobile - Whether to render as bottom sheet (true) or centered modal (false)
 * @param {boolean} showCursor - Whether to show blinking cursor after title (default: true)
 */
const BottomSheet = ({
  isOpen,
  onClose,
  title,
  children,
  isMobile = false,
  showCursor = true,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);

  // Handle open/close animations
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small delay to trigger animation after mount
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Cursor blink effect
  useEffect(() => {
    if (!showCursor) return;
    const interval = setInterval(() => {
      setCursorVisible(v => !v);
    }, 530);
    return () => clearInterval(interval);
  }, [showCursor]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!shouldRender) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: isAnimating ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 2000,
        transition: 'background-color 0.3s ease',
      }}
    >
      {/* Sheet Container */}
      <div
        style={{
          backgroundColor: '#0d0d0d',
          border: '1px solid #333',
          borderBottom: isMobile ? 'none' : '1px solid #333',
          width: isMobile ? '100%' : '90%',
          maxWidth: isMobile ? '100%' : '400px',
          maxHeight: isMobile ? '85vh' : '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          // Animation
          transform: isMobile
            ? (isAnimating ? 'translateY(0)' : 'translateY(100%)')
            : (isAnimating ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.98)'),
          opacity: isAnimating ? 1 : 0,
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease',
          // Subtle scanline overlay effect
          backgroundImage: `
            linear-gradient(
              rgba(0, 0, 0, 0) 50%,
              rgba(0, 0, 0, 0.08) 50%
            )
          `,
          backgroundSize: '100% 4px',
          boxShadow: isAnimating
            ? '0 -4px 32px rgba(0, 255, 65, 0.08), 0 0 0 1px rgba(0, 255, 65, 0.03)'
            : 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isMobile ? '16px 20px 12px' : '20px 32px 16px',
            flexShrink: 0,
          }}
        >
          {/* Title */}
          <div
            style={{
              color: '#00ff41',
              fontSize: isMobile ? '11px' : '12px',
              fontFamily: '"IBM Plex Mono", "Fira Code", "SF Mono", monospace',
              letterSpacing: '1px',
              textShadow: '0 0 8px rgba(0, 255, 65, 0.5)',
            }}
          >
            &gt; {title}
            {showCursor && (
              <span style={{
                marginLeft: '2px',
                opacity: cursorVisible ? 1 : 0,
              }}>▌</span>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#666',
              padding: '4px',
              cursor: 'pointer',
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '18px',
              lineHeight: 1,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.target.style.color = '#ff4444';
              e.target.style.textShadow = '0 0 8px rgba(255, 68, 68, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.target.style.color = '#666';
              e.target.style.textShadow = 'none';
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: isMobile ? '8px 20px 20px' : '16px 32px 32px',
            overflowY: 'auto',
            flex: 1,
            // Custom scrollbar for terminal aesthetic
            scrollbarWidth: 'thin',
            scrollbarColor: '#333 #0d0d0d',
          }}
        >
          {children}
        </div>

        {/* Safe Area Spacer for Mobile (iPhone home indicator) */}
        {isMobile && (
          <div
            style={{
              paddingBottom: 'env(safe-area-inset-bottom, 32px)',
              backgroundColor: '#0d0d0d',
              flexShrink: 0,
            }}
          />
        )}
      </div>
    </div>
  );
};

export default BottomSheet;
