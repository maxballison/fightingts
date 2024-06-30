// game.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:3001');

interface Player {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isGrounded: boolean;
  isAttacking: boolean;
  attackBox: { x: number, y: number, width: number, height: number };
  keys: { [key: string]: boolean };
}

interface Globals {
  speed: number;
  gravity: number;
  friction: number;
}

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [players, setPlayers] = useState<{ [key: string]: Player }>({});
  const playerRef = useRef<Player>({
    id: '',
    x: 50,
    y: 50,
    vx: 0,
    vy: 0,
    isGrounded: true,
    isAttacking: false,
    attackBox: { x: 50, y: 50, width: 50, height: 50 },
    keys: {}
  });
  const keys = useRef<{ [key: string]: boolean }>({});
  const [globals, setGlobals] = useState<Globals>({ speed: 2, gravity: 0.1, friction: 0.98 });

  useEffect(() => {
    socket.on('currentPlayers', (players: { [key: string]: Player }) => {
      setPlayers(players);
    });

    socket.on('newPlayer', (player: Player) => {
      setPlayers((prevPlayers) => ({
        ...prevPlayers,
        [player.id]: player,
      }));
    });

    socket.on('playerMoved', (player: Player) => {
      setPlayers((prevPlayers) => ({
        ...prevPlayers,
        [player.id]: player,
      }));
    });

    socket.on('playerDisconnected', (playerId: string) => {
      setPlayers((prevPlayers) => {
        const newPlayers = { ...prevPlayers };
        delete newPlayers[playerId];
        return newPlayers;
      });
    });

    socket.on('globalParams', (newGlobals: Globals) => {
      setGlobals(newGlobals);
    });

    socket.on('updatePlayers', (serverPlayers: { [key: string]: Player }) => {
      setPlayers(serverPlayers);

      const localPlayer = playerRef.current;
      const serverPlayer = serverPlayers[localPlayer.id];

      if (serverPlayer && (localPlayer.x !== serverPlayer.x || localPlayer.y !== serverPlayer.y)) {
        playerRef.current = serverPlayer;
      }
    });

    return () => {
      socket.off('currentPlayers');
      socket.off('newPlayer');
      socket.off('playerMoved');
      socket.off('playerDisconnected');
      socket.off('globalParams');
      socket.off('updatePlayers');
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      socket.emit('keyPress', { keys: keys.current });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
      socket.emit('keyPress', { keys: keys.current });
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const updatePlayerPosition = useCallback(() => {
    const player = playerRef.current;

    if (keys.current['KeyA']) {
      player.vx = -globals.speed;
    } else if (keys.current['KeyD']) {
      player.vx = globals.speed;
    } else {
      player.vx = 0;
    }

    if (keys.current['Space'] && player.isGrounded) {
      player.vy = -5;
      player.isGrounded = false;
    }

    player.vy += globals.gravity; // gravity
    player.vx *= globals.friction; // friction

    player.x += player.vx;
    player.y += player.vy;

    if (player.y > canvasRef.current!.height - 50) {
      player.y = canvasRef.current!.height - 50;
      player.vy = 0;
      player.isGrounded = true;
    }

    // Handle attack
    if (keys.current['KeyJ']) {
      player.isAttacking = true;
      player.attackBox.x = player.x + (player.vx > 0 ? 50 : -50);
      player.attackBox.y = player.y;
    } else {
      player.isAttacking = false;
    }

    socket.emit('playerMovement', { x: player.x, y: player.y, vx: player.vx, vy: player.vy, isGrounded: player.isGrounded, isAttacking: player.isAttacking, attackBox: player.attackBox });
  }, [globals]);

  useEffect(() => {
    let animationFrameId: number;
    const gameLoop = () => {
      updatePlayerPosition();
      animationFrameId = requestAnimationFrame(gameLoop);
    };
    
    setTimeout(gameLoop, 3); // Introduce a 3ms delay
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [updatePlayerPosition]);

  useEffect(() => {
  const canvas = canvasRef.current;
  const ctx = canvas?.getContext('2d');
  const draw = () => {
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      Object.values(players).forEach((player) => {
        ctx.fillStyle = 'blue';
        ctx.fillRect(player.x, player.y, 50, 50);
  
        if (player.isAttacking) {
          ctx.fillStyle = 'red';
          ctx.fillRect(player.attackBox.x, player.attackBox.y, player.attackBox.width, player.attackBox.height);
        }
      });
    }
  };
  
  let renderFrameId: number;
  
  const renderLoop = () => {
    draw();
    renderFrameId = requestAnimationFrame(renderLoop);
  };
  
  renderLoop();
  
  return () => {
    cancelAnimationFrame(renderFrameId);
  };
}, [players]);

return <canvas ref={canvasRef} width={800} height={400} style={{ border: '1px solid black' }} />;
};

export default Game;