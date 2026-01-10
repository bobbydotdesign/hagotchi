import React, { useState, useEffect } from 'react';
import { getRarityColor } from '../../data/hagotchiSkins';
import { getDailyBriefingMessage } from '../../data/encouragementMessages';

const DAILY_BRIEFING_KEY = 'hagotchi_daily_briefing_v1';
const LOCATION_PERMISSION_KEY = 'hagotchi_location_asked';

// Check if we should show the daily briefing (once per day)
export const shouldShowDailyBriefing = () => {
  try {
    const lastShown = localStorage.getItem(DAILY_BRIEFING_KEY);
    if (!lastShown) return true;

    const today = new Date().toDateString();
    return lastShown !== today;
  } catch {
    return false;
  }
};

// Mark daily briefing as shown
export const markDailyBriefingShown = () => {
  try {
    localStorage.setItem(DAILY_BRIEFING_KEY, new Date().toDateString());
  } catch {
    // Ignore storage errors
  }
};

// Holidays and fun facts for each day
const HOLIDAYS = {
  // Format: "MM-DD": { name, fact }
  "01-01": { name: "New Year's Day", fact: "The tradition of making resolutions dates back 4,000 years to ancient Babylon." },
  "01-15": { name: "Martin Luther King Jr. Day", fact: "MLK's 'I Have a Dream' speech was partly improvised." },
  "01-21": { name: "National Hugging Day", fact: "Hugging releases oxytocin and reduces stress hormones." },
  "02-02": { name: "Groundhog Day", fact: "Punxsutawney Phil has been predicting weather since 1887." },
  "02-14": { name: "Valentine's Day", fact: "About 150 million Valentine's cards are exchanged every year." },
  "03-14": { name: "Pi Day", fact: "Pi has been calculated to over 100 trillion digits." },
  "03-17": { name: "St. Patrick's Day", fact: "St. Patrick wasn't Irish—he was born in Roman Britain." },
  "04-01": { name: "April Fools' Day", fact: "The earliest recorded April Fools' prank was in 1698." },
  "04-22": { name: "Earth Day", fact: "The first Earth Day in 1970 led to the creation of the EPA." },
  "05-04": { name: "Star Wars Day", fact: "May the Fourth be with you! The first film made $775 million." },
  "05-05": { name: "Cinco de Mayo", fact: "It celebrates Mexico's victory over France in 1862, not independence." },
  "06-19": { name: "Juneteenth", fact: "It commemorates the end of slavery in the United States in 1865." },
  "06-21": { name: "Summer Solstice", fact: "The longest day of the year in the Northern Hemisphere." },
  "07-04": { name: "Independence Day", fact: "Three presidents died on July 4th: Adams, Jefferson, and Monroe." },
  "07-20": { name: "Moon Day", fact: "Neil Armstrong's first steps on the Moon were watched by 600 million people." },
  "09-19": { name: "Talk Like a Pirate Day", fact: "Arrr! This holiday was created by two friends in 1995." },
  "10-31": { name: "Halloween", fact: "Americans spend about $10 billion on Halloween each year." },
  "11-11": { name: "Veterans Day", fact: "Originally called Armistice Day, marking the end of WWI." },
  "12-21": { name: "Winter Solstice", fact: "The shortest day of the year in the Northern Hemisphere." },
  "12-24": { name: "Christmas Eve", fact: "NORAD has been tracking Santa since 1955." },
  "12-25": { name: "Christmas Day", fact: "'Jingle Bells' was originally written for Thanksgiving." },
  "12-31": { name: "New Year's Eve", fact: "The Times Square ball has been dropping since 1907." },
};

// Fun facts for regular days
const GENERAL_FACTS = [
  "The average person walks about 100,000 miles in their lifetime.",
  "Honey never spoils—3,000-year-old honey was found edible in Egyptian tombs.",
  "Octopuses have three hearts and blue blood.",
  "A group of flamingos is called a 'flamboyance.'",
  "The inventor of the Pringles can is buried in one.",
  "Bananas are berries, but strawberries aren't.",
  "Scotland's national animal is the unicorn.",
  "The shortest war in history lasted 38 minutes.",
  "A day on Venus is longer than its year.",
  "Cows have best friends and get stressed when separated.",
  "The moon has moonquakes.",
  "Wombat poop is cube-shaped.",
  "Dolphins have names for each other.",
  "A jiffy is an actual unit of time: 1/100th of a second.",
  "The Hawaiian pizza was invented in Canada.",
];

// Get today's holiday or a random fun fact
const getTodayFact = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const key = `${month}-${day}`;

  if (HOLIDAYS[key]) {
    return { type: 'holiday', ...HOLIDAYS[key] };
  }

  // Return a random fun fact for non-holiday days
  const randomFact = GENERAL_FACTS[Math.floor(Math.random() * GENERAL_FACTS.length)];
  return { type: 'fact', name: 'Fun Fact', fact: randomFact };
};

// Spoofed weather data for now
const getSpoofedWeather = () => {
  const conditions = [
    { temp: 72, condition: 'Sunny', icon: '☀️' },
    { temp: 68, condition: 'Partly Cloudy', icon: '⛅' },
    { temp: 65, condition: 'Cloudy', icon: '☁️' },
    { temp: 58, condition: 'Light Rain', icon: '🌧️' },
    { temp: 45, condition: 'Cold', icon: '❄️' },
    { temp: 75, condition: 'Clear', icon: '🌤️' },
  ];
  return conditions[Math.floor(Math.random() * conditions.length)];
};

const DailyBriefing = ({
  skin,
  onDismiss,
  isMobile,
}) => {
  const [animationFrame, setAnimationFrame] = useState(0);
  const [fadeIn, setFadeIn] = useState(false);
  const [message, setMessage] = useState('');
  const [weather, setWeather] = useState(null);
  const [todayFact, setTodayFact] = useState(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [locationStatus, setLocationStatus] = useState('unknown');

  // Animation loop for idle bouncing
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationFrame(prev => (prev + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Fade in on mount
  useEffect(() => {
    const timer = setTimeout(() => setFadeIn(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Generate message and get today's fact on mount
  useEffect(() => {
    if (skin?.personality) {
      setMessage(getDailyBriefingMessage(skin.personality));
    }
    setTodayFact(getTodayFact());

    // Check if we've already asked for location
    const hasAsked = localStorage.getItem(LOCATION_PERMISSION_KEY);
    if (!hasAsked) {
      // Show location prompt after a short delay
      setTimeout(() => setShowLocationPrompt(true), 800);
    } else {
      // Use spoofed weather for now
      setWeather(getSpoofedWeather());
    }
  }, [skin]);

  const handleLocationAllow = async () => {
    setLocationStatus('asking');
    localStorage.setItem(LOCATION_PERMISSION_KEY, 'asked');

    // For now, just use spoofed weather
    setTimeout(() => {
      setWeather(getSpoofedWeather());
      setShowLocationPrompt(false);
      setLocationStatus('granted');
    }, 500);
  };

  const handleLocationDeny = () => {
    localStorage.setItem(LOCATION_PERMISSION_KEY, 'denied');
    setShowLocationPrompt(false);
    setLocationStatus('denied');
    setWeather(getSpoofedWeather());
  };

  if (!skin) return null;

  const bounceOffset = Math.sin(animationFrame * Math.PI / 2) * 4;

  const formatDate = () => {
    const now = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    return now.toLocaleDateString('en-US', options);
  };

  const handleBeginDay = () => {
    if (showLocationPrompt) return;
    markDailyBriefingShown();
    if (onDismiss) onDismiss();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#0a0a0a',
        fontFamily: '"IBM Plex Mono", "Fira Code", "SF Mono", monospace',
        color: '#00ff41',
        zIndex: 9999,
        opacity: fadeIn ? 1 : 0,
        transition: 'opacity 0.5s ease-out',
        overflow: 'hidden',
      }}
    >
      {/* Scanline effect */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* Vignette */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* Location Permission Prompt */}
      {showLocationPrompt && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: 20,
          }}
        >
          <div style={{ maxWidth: '320px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>📍</div>
            <div style={{
              fontSize: '14px',
              color: '#fff',
              marginBottom: '12px',
              fontWeight: 'bold',
            }}>
              Enable Weather?
            </div>
            <div style={{
              fontSize: '12px',
              color: '#888',
              marginBottom: '24px',
              lineHeight: 1.5,
            }}>
              Your Hagotchi can show you the local weather each morning to help you plan your day.
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleLocationDeny}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'transparent',
                  border: '1px solid #444',
                  color: '#888',
                  fontFamily: 'inherit',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Not now
              </button>
              <button
                onClick={handleLocationAllow}
                disabled={locationStatus === 'asking'}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'rgba(0, 255, 65, 0.1)',
                  border: '1px solid #00ff41',
                  color: '#00ff41',
                  fontFamily: 'inherit',
                  fontSize: '12px',
                  cursor: locationStatus === 'asking' ? 'wait' : 'pointer',
                }}
              >
                {locationStatus === 'asking' ? 'Loading...' : 'Allow'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content wrapper - simple vertical layout */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        WebkitBoxOrient: 'vertical',
        WebkitBoxDirection: 'normal',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 2,
      }}>
        {/* TOP: Date & Weather */}
        <div style={{
          paddingTop: '70px',
          paddingBottom: '16px',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: isMobile ? '16px' : '14px',
            letterSpacing: '1px',
            color: '#fff',
            marginBottom: '8px',
          }}>
            {formatDate()}
          </div>

          {todayFact?.type === 'holiday' && (
            <div style={{
              fontSize: '11px',
              letterSpacing: '1px',
              color: '#ffaa00',
              marginBottom: '8px',
              padding: '4px 12px',
              border: '1px solid #ffaa00',
              textTransform: 'uppercase',
              display: 'inline-block',
            }}>
              {todayFact.name}
            </div>
          )}

          {weather && !showLocationPrompt && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '13px',
              color: '#888',
            }}>
              <span style={{ fontSize: '20px' }}>{weather.icon}</span>
              <span>{weather.temp}°F</span>
              <span style={{ color: '#666' }}>·</span>
              <span>{weather.condition}</span>
            </div>
          )}
        </div>

        {/* SPACER */}
        <div style={{ flex: 1 }} />

        {/* MIDDLE: Hagotchi & Message */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '0 24px',
        }}>
          {/* Speech Bubble */}
          <div style={{
            position: 'relative',
            maxWidth: '320px',
            marginBottom: '16px',
          }}>
            <div style={{
              padding: isMobile ? '16px 20px' : '14px 18px',
              backgroundColor: '#0a0a0a',
              border: '1px solid #00ff41',
              borderRadius: '12px',
              boxShadow: '0 0 20px rgba(0, 255, 65, 0.15)',
            }}>
              <p style={{
                fontSize: isMobile ? '15px' : '13px',
                color: '#00ff41',
                margin: 0,
                textAlign: 'center',
                lineHeight: 1.5,
                textShadow: '0 0 10px rgba(0, 255, 65, 0.3)',
              }}>
                "{message}"
              </p>
            </div>
            <div style={{
              position: 'absolute',
              bottom: '-8px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '8px solid #00ff41',
            }} />
          </div>

          {/* Hagotchi */}
          <div style={{
            transform: `translateY(${-bounceOffset}px)`,
            marginBottom: '12px',
          }}>
            <img
              src={skin.image}
              alt={skin.name}
              style={{
                width: isMobile ? '120px' : '100px',
                height: isMobile ? '120px' : '100px',
                imageRendering: 'pixelated',
              }}
            />
          </div>

          {/* Name */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{
              fontSize: isMobile ? '12px' : '11px',
              color: '#666',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}>
              {skin.name}
            </span>
            <span style={{
              fontSize: '9px',
              color: getRarityColor(skin.rarity),
              textTransform: 'uppercase',
            }}>
              [{skin.rarity}]
            </span>
          </div>
        </div>

        {/* SPACER */}
        <div style={{ flex: 1 }} />

        {/* BOTTOM: Fact & Button */}
        {!showLocationPrompt && (
          <div style={{
            paddingTop: '16px',
            paddingBottom: '50px',
            textAlign: 'center',
          }}>
            {todayFact && (
              <div style={{
                maxWidth: '340px',
                padding: '0 24px',
                marginBottom: '24px',
              }}>
                <div style={{
                  fontSize: '11px',
                  color: todayFact.type === 'holiday' ? '#ffaa00' : '#888',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}>
                  {todayFact.type === 'holiday' ? `Today: ${todayFact.name}` : 'Did You Know?'}
                </div>
                <div style={{
                  fontSize: '13px',
                  color: '#666',
                  lineHeight: 1.5,
                }}>
                  {todayFact.fact}
                </div>
              </div>
            )}

            <button
              onClick={handleBeginDay}
              style={{
                padding: '14px 32px',
                backgroundColor: 'rgba(0, 255, 65, 0.1)',
                border: '2px solid #00ff41',
                color: '#00ff41',
                fontFamily: 'inherit',
                fontSize: '14px',
                fontWeight: 'bold',
                letterSpacing: '1px',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              Begin My Day
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyBriefing;
