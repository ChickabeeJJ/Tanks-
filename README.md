# Tanks

A 3D multiplayer tank arena built for **CrazyGames** (HTML5 + three.js, CrazyGames SDK v3). It recreates the Roblox tank game's loop: a lobby hub, a shape-farming arena, a deep tank upgrade tree, stat points, and Rank, Quests, Gifts, a Wheel, Chests and Shops. Bots fill every match when there aren't enough players.

Tanks are **blue by default**. Skins are cosmetic and bought with gems.

## Run it

```bash
npm install
npm start          # http://localhost:3000  (game + multiplayer server)
npm test           # headless simulation smoke test
```

If the page can't reach a server, it runs the same simulation in the browser with bots, so the game is always playable.

## What's in the game

| Area | Details |
|---|---|
| Lobby | A compact 3D hub. Large pads open **Chests, Wheel, Skins Shop, Upgrades Shop, Tanks Shop**. Leaderboard boards show real players only (server data; offline they show just you). Drive into a portal to play. |
| Modes | **Spawn** (FFA), **Red VS Blue**, **4 Teams** |
| Arena | Anchored shapes (they never move): yellow cubes, blue cubes, pink pentagons, purple hexagons and big cyan Alphas, richer toward the center. XP, gems, a 30s spawn shield, health regen, team bases. A **Lobby** button returns you to the hub; if you were hit by a tank in the last 10 seconds it turns red, and leaving (or disconnecting) counts as a kill for your attacker. |
| Tank tree | ~50 tanks over tiers Lv 15 / 30 / 42 / 110 (Double → Triway → Fiveway → Phoenix, Scout → Hitman → Ace/Shadow, Spammer, Side, Grinder/Spiker melee, Freezer, Flame, Railgun, Blast Lord, Orbitron…). Some cost gems, some come from quests, chests or the wheel. |
| Keys | **Q** tank upgrades · **E** stats (**1-8**) · **F** auto fire · **R** auto spin · **C** turn 180° · **Shift** camera lock · **X** index · **G** gifts · **Enter** chat · WASD + mouse · right-drag rotates the camera · scroll zooms |
| Progress | Persistent level (Lv 400 needs ~90K XP, like the original). Stat points scale with level, and stat caps can be raised in the Upgrades Shop. |
| Meta | Rank (Bronze → Legend, with daily tasks), Daily/Weekly/Unique/Event quests, playtime Gifts, Wheel (free spin every 4h + ad spins), Frozen/Lava chests (with a free daily chest), Bag, Index, Store |
| Mobile | Twin virtual joysticks and a compact HUD |

### Robux → CrazyGames

Things the Roblox game sells for Robux are rewarded ads here, or free:

- Starter pack, gem packs, wheel spins and the "+XP" button are **rewarded ads**.
- Midgame ads run only at natural breaks (respawning or going back to the lobby), at most every 2-3 minutes.
- Trading and gifting to friends are left out: they need account-bound inventories, which CrazyGames doesn't provide.

### CrazyGames SDK usage (`public/js/sdk.js`)

- `loadingStart/Stop`, `gameplayStart/Stop` (on spawn, death and lobby), and `happytime` on kills, rank-ups and chests.
- `ad.requestAd('midgame' | 'rewarded')`, with audio muted and gameplay paused during ads.
- `data.getItem/setItem` for saves (level, XP, gems, unlocks, quests). Every save is written to the CrazyGames data module **and** a localStorage mirror; on load the copy with the most progress wins. Level-ups save immediately.
- `user.getUser` for the default name.
- `game.inviteLink`, `showInviteButton`, `getInviteParam('room')` and `isInstantMultiplayer`, so invites land in the same server.
- Respects `settings.muteAudio` and `settings.disableChat`. Chat is filtered and rate-limited.

## Deploying

1. **Server**: deploy the repo to any Node host (Render, Railway, Fly.io, a VPS) or use the `Dockerfile`. It listens on `$PORT` and serves `/ws`, `/api/leaderboard` and `/api/rooms`.
2. **CrazyGames build**:

   ```bash
   npm run build -- --server wss://YOUR-SERVER/ws
   ```

   This writes `dist/crazygames/` and `dist/tanks-crazygames.zip`. Upload the zip (~0.9 MB). Without `--server` the build is offline-only, with bots.

## Project layout

```
public/            static client (this is what ships to CrazyGames)
  shared/          simulation shared by browser + server (world, tanks, progression, config)
  js/              client: game.js (arena), lobby.js, net.js, profile.js, ui/, render/
  vendor/          three.js r160
server/server.js   rooms, bot fill, snapshots (15 Hz, area-of-interest), leaderboards
scripts/           build, sim test, multiplayer test
```

The server is authoritative. It runs at 30 ticks/s and sends area-of-interest snapshots of about 2-3 KB each. Clients interpolate other entities and predict their own tank with reconciliation.
