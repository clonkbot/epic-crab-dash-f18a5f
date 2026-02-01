import React, { useState, useEffect, useRef, useCallback } from 'react';

type GameState = 'menu' | 'playing' | 'gameover';
type ObstacleType = 'rock' | 'wave' | 'seagull' | 'jellyfish';

interface Obstacle {
  id: number;
  x: number;
  y: number;
  type: ObstacleType;
  width: number;
  height: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const GAME_WIDTH = 800;
const GAME_HEIGHT = 400;
const GROUND_Y = 320;
const CRAB_WIDTH = 50;
const CRAB_HEIGHT = 40;
const GRAVITY = 0.8;
const JUMP_FORCE = -15;
const SLIDE_HEIGHT = 20;

function App() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('epicCrabDashHighScore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [crabY, setCrabY] = useState(GROUND_Y - CRAB_HEIGHT);
  const [crabVelocity, setCrabVelocity] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [gameSpeed, setGameSpeed] = useState(6);
  const [parallaxOffset, setParallaxOffset] = useState(0);

  const gameLoopRef = useRef<number>();
  const obstacleIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const lastObstacleTimeRef = useRef(0);
  const frameCountRef = useRef(0);

  const createParticles = useCallback((x: number, y: number, count: number, color: string) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 1) * 6,
        life: 30 + Math.random() * 20,
        color,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  const spawnObstacle = useCallback(() => {
    const types: ObstacleType[] = ['rock', 'wave', 'seagull', 'jellyfish'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let y: number;
    let width: number;
    let height: number;
    
    switch (type) {
      case 'rock':
        y = GROUND_Y - 35;
        width = 45;
        height = 35;
        break;
      case 'wave':
        y = GROUND_Y - 50;
        width = 60;
        height = 50;
        break;
      case 'seagull':
        y = GROUND_Y - 100 - Math.random() * 60;
        width = 50;
        height = 30;
        break;
      case 'jellyfish':
        y = GROUND_Y - 70 - Math.random() * 40;
        width = 35;
        height = 45;
        break;
    }
    
    setObstacles(prev => [...prev, {
      id: obstacleIdRef.current++,
      x: GAME_WIDTH + 50,
      y,
      type,
      width,
      height,
    }]);
  }, []);

  const checkCollision = useCallback((crabYPos: number, sliding: boolean) => {
    const crabX = 100;
    const crabH = sliding ? SLIDE_HEIGHT : CRAB_HEIGHT;
    const crabYOffset = sliding ? GROUND_Y - SLIDE_HEIGHT : crabYPos;
    
    for (const obs of obstacles) {
      const obsRight = obs.x + obs.width;
      const obsBottom = obs.y + obs.height;
      const crabRight = crabX + CRAB_WIDTH;
      const crabBottom = crabYOffset + crabH;
      
      if (
        crabX < obsRight &&
        crabRight > obs.x &&
        crabYOffset < obsBottom &&
        crabBottom > obs.y
      ) {
        return true;
      }
    }
    return false;
  }, [obstacles]);

  const gameLoop = useCallback(() => {
    frameCountRef.current++;
    
    // Update parallax
    setParallaxOffset(prev => (prev + gameSpeed * 0.5) % 800);
    
    // Update crab physics
    setCrabY(prevY => {
      let newY = prevY;
      let newVel = crabVelocity;
      
      if (isJumping || prevY < GROUND_Y - CRAB_HEIGHT) {
        newVel += GRAVITY;
        newY += newVel;
        setCrabVelocity(newVel);
        
        if (newY >= GROUND_Y - CRAB_HEIGHT) {
          newY = GROUND_Y - CRAB_HEIGHT;
          setCrabVelocity(0);
          setIsJumping(false);
        }
      }
      
      return newY;
    });
    
    // Update obstacles
    setObstacles(prev => {
      const updated = prev
        .map(obs => ({ ...obs, x: obs.x - gameSpeed }))
        .filter(obs => obs.x > -100);
      return updated;
    });
    
    // Update particles
    setParticles(prev => prev
      .map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + 0.3,
        life: p.life - 1,
      }))
      .filter(p => p.life > 0)
    );
    
    // Spawn obstacles
    const now = Date.now();
    if (now - lastObstacleTimeRef.current > 1500 - Math.min(score * 2, 800)) {
      spawnObstacle();
      lastObstacleTimeRef.current = now;
    }
    
    // Increase difficulty
    if (frameCountRef.current % 300 === 0) {
      setGameSpeed(prev => Math.min(prev + 0.5, 15));
    }
    
    // Score
    if (frameCountRef.current % 10 === 0) {
      setScore(prev => prev + 1);
    }
    
    // Sand particles
    if (frameCountRef.current % 5 === 0) {
      createParticles(110, GROUND_Y - 5, 1, '#ffcc80');
    }
    
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [crabVelocity, gameSpeed, isJumping, score, spawnObstacle, createParticles]);

  // Collision detection in separate effect
  useEffect(() => {
    if (gameState === 'playing') {
      if (checkCollision(crabY, isSliding)) {
        // Game over
        setGameState('gameover');
        if (score > highScore) {
          setHighScore(score);
          localStorage.setItem('epicCrabDashHighScore', score.toString());
        }
        createParticles(120, crabY + 20, 20, '#ff2d95');
      }
    }
  }, [gameState, crabY, isSliding, checkCollision, score, highScore, createParticles]);

  useEffect(() => {
    if (gameState === 'playing') {
      frameCountRef.current = 0;
      lastObstacleTimeRef.current = Date.now();
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, gameLoop]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (gameState === 'menu' || gameState === 'gameover') {
      if (e.code === 'Space' || e.code === 'Enter') {
        startGame();
      }
      return;
    }
    
    if (gameState === 'playing') {
      if ((e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') && !isJumping && !isSliding) {
        setCrabVelocity(JUMP_FORCE);
        setIsJumping(true);
        createParticles(100, GROUND_Y - 10, 5, '#00f5ff');
      }
      if ((e.code === 'ArrowDown' || e.code === 'KeyS') && !isJumping) {
        setIsSliding(true);
      }
    }
  }, [gameState, isJumping, isSliding, createParticles]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      setIsSliding(false);
    }
  }, []);

  const handleTouch = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const y = touch.clientY - rect.top;
    
    if (gameState === 'menu' || gameState === 'gameover') {
      startGame();
      return;
    }
    
    if (gameState === 'playing') {
      if (y < rect.height / 2 && !isJumping && !isSliding) {
        setCrabVelocity(JUMP_FORCE);
        setIsJumping(true);
        createParticles(100, GROUND_Y - 10, 5, '#00f5ff');
      } else if (y >= rect.height / 2) {
        setIsSliding(true);
        setTimeout(() => setIsSliding(false), 500);
      }
    }
  }, [gameState, isJumping, isSliding, createParticles]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setCrabY(GROUND_Y - CRAB_HEIGHT);
    setCrabVelocity(0);
    setIsSliding(false);
    setIsJumping(false);
    setObstacles([]);
    setParticles([]);
    setGameSpeed(6);
    setParallaxOffset(0);
  };

  const renderCrab = () => {
    const height = isSliding ? SLIDE_HEIGHT : CRAB_HEIGHT;
    const y = isSliding ? GROUND_Y - SLIDE_HEIGHT : crabY;
    
    return (
      <g transform={`translate(100, ${y})`}>
        {/* Neon glow */}
        <ellipse 
          cx={CRAB_WIDTH/2} 
          cy={height/2} 
          rx={CRAB_WIDTH/2 + 5} 
          ry={height/2 + 5} 
          fill="none" 
          stroke="#ff2d95" 
          strokeWidth="2" 
          opacity="0.5"
          style={{ filter: 'blur(4px)' }}
        />
        {/* Body */}
        <ellipse 
          cx={CRAB_WIDTH/2} 
          cy={height/2 + 5} 
          rx={CRAB_WIDTH/2 - 5} 
          ry={height/2 - 5} 
          fill="#ff2d95"
        />
        {/* Shell pattern */}
        <ellipse 
          cx={CRAB_WIDTH/2} 
          cy={height/2 + 3} 
          rx={CRAB_WIDTH/2 - 10} 
          ry={height/2 - 10} 
          fill="#ff6baf"
        />
        {!isSliding && (
          <>
            {/* Eyes */}
            <circle cx={CRAB_WIDTH/2 - 8} cy={8} r={6} fill="#fff" />
            <circle cx={CRAB_WIDTH/2 + 8} cy={8} r={6} fill="#fff" />
            <circle cx={CRAB_WIDTH/2 - 6} cy={8} r={3} fill="#000" />
            <circle cx={CRAB_WIDTH/2 + 10} cy={8} r={3} fill="#000" />
            {/* Eye glow */}
            <circle cx={CRAB_WIDTH/2 - 8} cy={8} r={7} fill="none" stroke="#00f5ff" strokeWidth="1" opacity="0.8" />
            <circle cx={CRAB_WIDTH/2 + 8} cy={8} r={7} fill="none" stroke="#00f5ff" strokeWidth="1" opacity="0.8" />
            {/* Claws */}
            <ellipse cx={-5} cy={height/2 + 5} rx={12} ry={8} fill="#ff5580" />
            <ellipse cx={CRAB_WIDTH + 5} cy={height/2 + 5} rx={12} ry={8} fill="#ff5580" />
            {/* Legs */}
            {[0, 1, 2].map(i => (
              <React.Fragment key={i}>
                <line x1={10 + i*10} y1={height - 5} x2={5 + i*8} y2={height + 8} stroke="#ff5580" strokeWidth="3" />
                <line x1={CRAB_WIDTH - 10 - i*10} y1={height - 5} x2={CRAB_WIDTH - 5 - i*8} y2={height + 8} stroke="#ff5580" strokeWidth="3" />
              </React.Fragment>
            ))}
          </>
        )}
        {/* Neon outline */}
        <ellipse 
          cx={CRAB_WIDTH/2} 
          cy={height/2 + 5} 
          rx={CRAB_WIDTH/2 - 3} 
          ry={height/2 - 3} 
          fill="none" 
          stroke="#00f5ff" 
          strokeWidth="2"
          opacity="0.8"
        />
      </g>
    );
  };

  const renderObstacle = (obs: Obstacle) => {
    switch (obs.type) {
      case 'rock':
        return (
          <g key={obs.id} transform={`translate(${obs.x}, ${obs.y})`}>
            <polygon 
              points="5,35 15,10 25,0 35,8 45,35" 
              fill="#4a4a6a"
            />
            <polygon 
              points="10,35 18,15 28,8 38,35" 
              fill="#5a5a8a"
            />
            <polygon 
              points="5,35 15,10 25,0 35,8 45,35" 
              fill="none"
              stroke="#b347ff"
              strokeWidth="2"
              opacity="0.6"
            />
          </g>
        );
      case 'wave':
        return (
          <g key={obs.id} transform={`translate(${obs.x}, ${obs.y})`}>
            <path 
              d="M0,50 Q15,20 30,30 T60,25 L60,50 Z" 
              fill="rgba(0,245,255,0.3)"
            />
            <path 
              d="M0,50 Q15,25 30,35 T60,30" 
              fill="none"
              stroke="#00f5ff"
              strokeWidth="3"
            />
            <path 
              d="M5,45 Q20,30 35,38 T55,35" 
              fill="none"
              stroke="#00f5ff"
              strokeWidth="2"
              opacity="0.6"
            />
          </g>
        );
      case 'seagull':
        return (
          <g key={obs.id} transform={`translate(${obs.x}, ${obs.y})`}>
            <path 
              d="M0,15 Q10,0 25,15 Q40,0 50,15" 
              fill="none"
              stroke="#fff"
              strokeWidth="4"
            />
            <path 
              d="M0,15 Q10,0 25,15 Q40,0 50,15" 
              fill="none"
              stroke="#ff6b2d"
              strokeWidth="2"
              style={{ filter: 'blur(2px)' }}
            />
            <circle cx={25} cy={18} r={5} fill="#fff" />
            <circle cx={27} cy={17} r={2} fill="#000" />
            <polygon points="32,18 40,16 32,20" fill="#ff6b2d" />
          </g>
        );
      case 'jellyfish':
        return (
          <g key={obs.id} transform={`translate(${obs.x}, ${obs.y})`}>
            <ellipse cx={17} cy={15} rx={15} ry={15} fill="rgba(179,71,255,0.4)" />
            <ellipse cx={17} cy={15} rx={12} ry={12} fill="rgba(179,71,255,0.6)" />
            <ellipse cx={17} cy={15} rx={15} ry={15} fill="none" stroke="#b347ff" strokeWidth="2" />
            {/* Tentacles */}
            {[0, 1, 2, 3].map(i => (
              <path 
                key={i}
                d={`M${8 + i*6},28 Q${5 + i*6},35 ${10 + i*6},42 Q${7 + i*6},48 ${9 + i*6},55`}
                fill="none"
                stroke="#b347ff"
                strokeWidth="2"
                opacity="0.8"
              />
            ))}
            {/* Glow */}
            <ellipse cx={17} cy={15} rx={18} ry={18} fill="none" stroke="#b347ff" strokeWidth="4" opacity="0.3" style={{ filter: 'blur(4px)' }} />
          </g>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(180deg, #2d1b4e 0%, #4a1942 30%, #1a1a3e 70%, #0a0a1a 100%)' }}>
      {/* Stars background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 3 + 1 + 'px',
              height: Math.random() * 3 + 1 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 50 + '%',
              background: '#fff',
              opacity: Math.random() * 0.8 + 0.2,
              animation: `pulse-glow ${2 + Math.random() * 3}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Title */}
      <h1 
        className="pixel-font text-2xl md:text-4xl mb-4 text-center neon-text"
        style={{ color: '#ff2d95' }}
      >
        EPIC CRAB DASH
      </h1>

      {/* Score Display */}
      <div className="flex gap-8 mb-4">
        <div className="text-center">
          <p className="text-xs md:text-sm neon-cyan-text" style={{ color: '#00f5ff' }}>SCORE</p>
          <p className="pixel-font text-lg md:text-2xl" style={{ color: '#fff' }}>{score}</p>
        </div>
        <div className="text-center">
          <p className="text-xs md:text-sm" style={{ color: '#ff6b2d' }}>HIGH SCORE</p>
          <p className="pixel-font text-lg md:text-2xl" style={{ color: '#fff' }}>{highScore}</p>
        </div>
      </div>

      {/* Game Canvas */}
      <div 
        className="relative rounded-lg overflow-hidden"
        style={{
          width: '100%',
          maxWidth: GAME_WIDTH + 'px',
          aspectRatio: `${GAME_WIDTH}/${GAME_HEIGHT}`,
          border: '4px solid #ff2d95',
          boxShadow: '0 0 20px #ff2d95, 0 0 40px rgba(255,45,149,0.5), inset 0 0 60px rgba(0,0,0,0.5)',
        }}
        onTouchStart={handleTouch}
      >
        <svg 
          viewBox={`0 0 ${GAME_WIDTH} ${GAME_HEIGHT}`}
          className="w-full h-full"
          style={{ background: 'linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 40%, #4a1942 100%)' }}
        >
          {/* Sun */}
          <defs>
            <radialGradient id="sunGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ff6b2d" />
              <stop offset="50%" stopColor="#ff2d95" />
              <stop offset="100%" stopColor="#ff2d95" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="oceanGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1a1a3e" />
              <stop offset="100%" stopColor="#0a0a1a" />
            </linearGradient>
          </defs>
          
          {/* Synthwave sun */}
          <circle cx={650} cy={180} r={80} fill="url(#sunGradient)" opacity="0.8" />
          {/* Sun lines */}
          {[...Array(8)].map((_, i) => (
            <rect 
              key={i} 
              x={570} 
              y={140 + i * 12} 
              width={160} 
              height={4} 
              fill="#1a0a2e"
              opacity="0.8"
            />
          ))}
          
          {/* Mountains - parallax layer 1 */}
          <g transform={`translate(${-parallaxOffset * 0.2}, 0)`}>
            <polygon points="-100,280 100,150 300,280" fill="#2d1b4e" />
            <polygon points="200,280 400,120 600,280" fill="#2d1b4e" />
            <polygon points="500,280 700,140 900,280" fill="#2d1b4e" />
            <polygon points="700,280 900,150 1100,280" fill="#2d1b4e" />
          </g>
          
          {/* Ocean - parallax layer 2 */}
          <rect x={0} y={280} width={GAME_WIDTH} height={120} fill="url(#oceanGradient)" />
          
          {/* Ocean waves - parallax */}
          <g transform={`translate(${-parallaxOffset * 0.5}, 0)`}>
            {[...Array(6)].map((_, i) => (
              <path 
                key={i}
                d={`M${i * 200 - 50},290 Q${i * 200 + 50},280 ${i * 200 + 100},290 T${i * 200 + 200},290`}
                fill="none"
                stroke="#00f5ff"
                strokeWidth="2"
                opacity="0.3"
              />
            ))}
          </g>
          
          {/* Beach/Ground */}
          <rect x={0} y={GROUND_Y} width={GAME_WIDTH} height={80} fill="#2a1f3d" />
          <rect x={0} y={GROUND_Y} width={GAME_WIDTH} height={3} fill="#ff6b2d" opacity="0.8" />
          
          {/* Grid lines on ground */}
          <g transform={`translate(${-parallaxOffset % 50}, 0)`}>
            {[...Array(20)].map((_, i) => (
              <line 
                key={i}
                x1={i * 50}
                y1={GROUND_Y}
                x2={i * 50 - 30}
                y2={GAME_HEIGHT}
                stroke="#b347ff"
                strokeWidth="1"
                opacity="0.3"
              />
            ))}
          </g>
          {[...Array(4)].map((_, i) => (
            <line 
              key={i}
              x1={0}
              y1={GROUND_Y + 20 + i * 20}
              x2={GAME_WIDTH}
              y2={GROUND_Y + 20 + i * 20}
              stroke="#b347ff"
              strokeWidth="1"
              opacity={0.3 - i * 0.05}
            />
          ))}
          
          {/* Obstacles */}
          {obstacles.map(renderObstacle)}
          
          {/* Crab */}
          {renderCrab()}
          
          {/* Particles */}
          {particles.map(p => (
            <circle 
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={3}
              fill={p.color}
              opacity={p.life / 50}
            />
          ))}
          
          {/* Menu Overlay */}
          {gameState === 'menu' && (
            <g>
              <rect x={0} y={0} width={GAME_WIDTH} height={GAME_HEIGHT} fill="rgba(10,10,26,0.85)" />
              <text 
                x={GAME_WIDTH/2} 
                y={150} 
                textAnchor="middle" 
                fill="#00f5ff" 
                fontSize="24"
                fontFamily="'Press Start 2P', cursive"
                style={{ filter: 'drop-shadow(0 0 10px #00f5ff)' }}
              >
                READY TO RUN?
              </text>
              <text 
                x={GAME_WIDTH/2} 
                y={220} 
                textAnchor="middle" 
                fill="#fff" 
                fontSize="12"
                fontFamily="'Orbitron', sans-serif"
              >
                SPACE / W / ↑ to JUMP
              </text>
              <text 
                x={GAME_WIDTH/2} 
                y={250} 
                textAnchor="middle" 
                fill="#fff" 
                fontSize="12"
                fontFamily="'Orbitron', sans-serif"
              >
                S / ↓ to SLIDE
              </text>
              <text 
                x={GAME_WIDTH/2} 
                y={280} 
                textAnchor="middle" 
                fill="#fff" 
                fontSize="12"
                fontFamily="'Orbitron', sans-serif"
              >
                Touch: Top half = Jump, Bottom half = Slide
              </text>
              <text 
                x={GAME_WIDTH/2} 
                y={330} 
                textAnchor="middle" 
                fill="#ff2d95" 
                fontSize="16"
                fontFamily="'Press Start 2P', cursive"
                style={{ filter: 'drop-shadow(0 0 10px #ff2d95)' }}
              >
                PRESS SPACE TO START
              </text>
            </g>
          )}
          
          {/* Game Over Overlay */}
          {gameState === 'gameover' && (
            <g>
              <rect x={0} y={0} width={GAME_WIDTH} height={GAME_HEIGHT} fill="rgba(10,10,26,0.9)" />
              <text 
                x={GAME_WIDTH/2} 
                y={140} 
                textAnchor="middle" 
                fill="#ff2d95" 
                fontSize="32"
                fontFamily="'Press Start 2P', cursive"
                style={{ filter: 'drop-shadow(0 0 15px #ff2d95)' }}
              >
                GAME OVER
              </text>
              <text 
                x={GAME_WIDTH/2} 
                y={200} 
                textAnchor="middle" 
                fill="#00f5ff" 
                fontSize="16"
                fontFamily="'Press Start 2P', cursive"
              >
                SCORE: {score}
              </text>
              {score >= highScore && score > 0 && (
                <text 
                  x={GAME_WIDTH/2} 
                  y={240} 
                  textAnchor="middle" 
                  fill="#ff6b2d" 
                  fontSize="14"
                  fontFamily="'Press Start 2P', cursive"
                  style={{ filter: 'drop-shadow(0 0 10px #ff6b2d)' }}
                >
                  NEW HIGH SCORE!
                </text>
              )}
              <text 
                x={GAME_WIDTH/2} 
                y={310} 
                textAnchor="middle" 
                fill="#b347ff" 
                fontSize="14"
                fontFamily="'Press Start 2P', cursive"
                style={{ filter: 'drop-shadow(0 0 8px #b347ff)' }}
              >
                PRESS SPACE TO RETRY
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Mobile Controls hint */}
      <div className="mt-4 text-center md:hidden">
        <p className="text-xs" style={{ color: '#00f5ff', opacity: 0.7 }}>
          Tap top half to JUMP • Tap bottom half to SLIDE
        </p>
      </div>

      {/* Desktop Controls reminder */}
      <div className="hidden md:block mt-4 text-center">
        <p className="text-xs" style={{ color: '#00f5ff', opacity: 0.7 }}>
          SPACE/W/↑ to Jump • S/↓ to Slide
        </p>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center">
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'Orbitron, sans-serif' }}>
          Requested by <span style={{ color: 'rgba(255,45,149,0.5)' }}>@hiighphill</span> · Built by <span style={{ color: 'rgba(0,245,255,0.5)' }}>@clonkbot</span>
        </p>
      </footer>
    </div>
  );
}

export default App;