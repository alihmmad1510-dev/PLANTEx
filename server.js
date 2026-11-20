// PLANET-X web host + simple room server
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(__dirname));
app.get('/health', (_req,res)=>res.json({ok:true, game:'PLANET-X'}));

const rooms = new Map();
io.on('connection', socket => {
  socket.on('room:join', ({code, playerName}={}) => {
    if (!code) return;
    code = String(code).trim().toUpperCase().slice(0,12);
    socket.join(code);
    socket.data.room = code;
    socket.data.playerName = String(playerName || 'Player').slice(0,24);
    if (!rooms.has(code)) rooms.set(code, new Set());
    rooms.get(code).add(socket.id);
    socket.emit('room:joined', {code, players:rooms.get(code).size});
    socket.to(code).emit('room:player-joined', {id:socket.id, name:socket.data.playerName});
    io.to(code).emit('room:count', rooms.get(code).size);
  });
  socket.on('room:leave', () => leaveRoom(socket));
  // Broadcast lightweight game-state messages to room members. Client must validate
  // and send only gameplay state; server intentionally does not accept arbitrary files.
  socket.on('planet:state', data => {
    const code=socket.data.room;
    if (!code || !data || typeof data !== 'object') return;
    socket.to(code).emit('planet:state', data);
  });
  socket.on('disconnect', () => leaveRoom(socket));
});
function leaveRoom(socket){
  const code=socket.data.room;
  if (!code) return;
  socket.leave(code);
  const set=rooms.get(code);
  if(set){set.delete(socket.id); if(!set.size) rooms.delete(code); else io.to(code).emit('room:count',set.size);}
  socket.data.room=null;
}
const port=process.env.PORT || 10000;
server.listen(port,'0.0.0.0',()=>console.log('PLANET-X listening on '+port));
