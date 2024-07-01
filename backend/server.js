// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const DEV_CONSOLE_PASSWORD = '';

const app = express();

app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://fightingts-1.onrender.com"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS,CONNECT,TRACE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Content-Type-Options, Accept, X-Requested-With, Origin, Access-Control-Request-Method, Access-Control-Request-Headers"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Private-Network", true);
  //  Firefox caps this at 24 hours (86400 seconds). Chromium (starting in v76) caps at 2 hours (7200 seconds). The default value is 5 seconds.
  res.setHeader("Access-Control-Max-Age", 7200);

  next();
});

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors({
  origin: "http://localhost:3000"
}));

let players = {};
let globals = {
  speed: 6,
  gravity: 0.17,
  friction: 0.93,
  jumpPower: 6.9
};

// Serve the dev console UI
app.get('/dev-console', (req, res) => {
  res.sendFile(path.join(__dirname, 'dev-console.html'));
});

const updatePlayerPosition = (player) => {
  if (player.keys['KeyA']) {
    player.vx = -globals.speed;
  } else if (player.keys['KeyD']) {
    player.vx = globals.speed;
  } 

  if (player.keys['Space'] && player.isGrounded) {
    player.vy = -globals.jumpPower;
    player.isGrounded = false;
  }

  player.vy += globals.gravity; // gravity
  player.vx *= globals.friction; // friction

  player.x += player.vx;
  player.y += player.vy;

  if (player.y > 350) {
    player.y = 350;
    player.vy = 0;
    player.isGrounded = true;
  }

  if (player.keys['KeyJ']) {
    player.isAttacking = true;
    player.attackBox.x = player.x + (player.vx > 0 ? 50 : -50);
    player.attackBox.y = player.y;
  } else {
    player.isAttacking = false;
  }
};

io.on('connection', (socket) => {
  const isDevConsole = socket.handshake.headers.referer.includes('dev-console');


  if (!isDevConsole) {
  console.log('A user connected:', socket.id);

  // Add new player to the players object
  players[socket.id] = {
    id: socket.id,
    x: 50,
    y: 50,
    vx: 0,
    vy: 0,
    isGrounded: true,
    isAttacking: false,
    attackBox: { x: 50, y: 50, width: 50, height: 50 },
    keys: {}
  };

  // Send the current players to the new player
  socket.emit('currentPlayers', players);

  // Notify other players of the new player
  socket.broadcast.emit('newPlayer', players[socket.id]);
}

  // Handle player key press
  socket.on('keyPress', (keyData) => {
    if (players[socket.id]) {
      players[socket.id].keys = keyData.keys;
    }
  });

  // Handle player disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });

  // Handle updateGlobals event
  socket.on('updateGlobals', (newGlobals) => {
    globals = { ...globals, ...newGlobals };
  });

  // Handle password checking
  socket.on('checkPassword', (password) => {
    const result = password === DEV_CONSOLE_PASSWORD;
    socket.emit('passwordResult', result);
  });
});

// Server game loop
setInterval(() => {
  Object.values(players).forEach((player) => {
    updatePlayerPosition(player);
  });
  io.emit('updatePlayers', players);
}, 1000 / 60); // 60 times per second

server.listen(3001, () => {
  console.log('Listening on *:3001');
});