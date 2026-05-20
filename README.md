# Public Multiplayer Lobby Game

This is a simple real-time multiplayer website game.

## Features
- Public room list
- Real people can join the same room
- Live movement with WASD or arrow keys
- Live room chat
- Multiple lobbies

## How to run on your computer

1. Install Node.js.
2. Open this folder in Terminal or Command Prompt.
3. Run:

```bash
npm install
npm start
```

4. Open:

```text
http://localhost:3000
```

## How to make friends join

You need to host it on a server that supports Node.js WebSockets, like Render, Railway, Fly.io, or Glitch.

Google Sites alone cannot run the live multiplayer server.
Netlify alone is not good for this exact server because WebSockets need a long-running backend.