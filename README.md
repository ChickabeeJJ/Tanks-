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
| Lobby | A compact 3D hub with flat metal walls. Large pads spread around the room open **Skins Shop, Upgrades Shop, Chests, Tanks Shop, Wheel**. Drive into a portal to play. No leaderboards. |
| Maps | Large floating arenas with cover walls (tanks and bullets collide with them; bots steer around them). |
| Servers | **Battle** (FFA), **Red VS Blue**, **4 Teams**. Roblox-style live servers: up to 10 players each (4 Teams: 16, max 4 per team), empty slots filled by up to 6 bots. Bots path-find around walls. Team modes keep a live team score (first team to 25 kills wins the round). Servers keep running when players die or leave (one per mode is always on), and rejoining drops you back into the running server. |
| Arena | Anchored shapes (they never move): yellow cubes, blue cubes, pink pentagons, purple hexagons and big cyan Alphas, richer toward the center. XP, gems, a 30s spawn shield, health regen, team bases. A **Lobby** button (bottom-left) returns you to the hub; if you were hit by a tank in the last 10 seconds it turns red, and leaving (or disconnecting) counts as a kill for your attacker. |
| Tank tree | ~50 tanks over tiers Lv 15 / 30 / 42 / 110 (Double → Triway → Fiveway → Phoenix, Scout → Hitman → Ace/Shadow, Spammer, Side, Grinder/Spiker melee, Freezer, Flame, Railgun, Blast Lord, Orbitron…). Some cost gems, some come from quests, chests or the wheel. |
| Keys | **Q** tank upgrades · **E** stats (**1-8**) · **F** auto fire · **R** auto spin · **C** turn 180° · **Shift** camera lock · **X** index · **G** gifts · **Enter** chat · WASD + mouse · right-drag rotates the camera · scroll zooms |
| Progress | Persistent level (Lv 400 needs ~90K XP, like the original). Stat points scale with level, and stat caps can be raised in the Upgrades Shop, which also sells XP, Gem and extra Stat Point boosts. |
| Meta | Rank (Bronze → Legend, with daily tasks), Daily/Weekly/Unique/Event quests, playtime Gifts, Wheel (free spin every 4h), Frozen/Lava chests with exclusive skins in 5 rarities and a casino-style reel opening (free Frozen chest daily), Bag, Index, Store |
| Mobile | Twin virtual joysticks and a compact HUD |

### Robux → CrazyGames (no ads in this launch)

This basic launch has **no ads**. Things the Roblox game sells for Robux are free here, on timers:

- Starter pack: free once a day. Gem packs: free, each on its own cooldown.
- The "+XP" button: free every 3 minutes. Wheel: one free spin every 4 hours, plus spins from gifts.
- The Rank task "Buy a Product" became "Spin the Wheel".
- Trading and gifting to friends are left out: they need account-bound inventories, which CrazyGames doesn't provide.

### CrazyGames SDK usage (`public/js/sdk.js`)

- `loadingStart/Stop`, `gameplayStart/Stop` (on spawn, death and lobby), and `happytime` on kills, rank-ups and chests.
- No leaderboards (removed from the lobby, the arena and the server).
- `data.getItem/setItem` for saves (level, XP, gems, unlocks, quests). Every save is written to the CrazyGames data module **and** a localStorage mirror; on load the copy with the most progress wins. Level-ups save immediately.
- `user.getUser` for the default name.
- `game.inviteLink`, `showInviteButton`, `getInviteParam('room')` and `isInstantMultiplayer`, so invites land in the same server.
- Respects `settings.muteAudio` and `settings.disableChat`. Chat is filtered and rate-limited.

## CrazyGames store assets

`store-assets/` holds the 3 covers and 2 preview videos CrazyGames asks for, plus `LISTING.md` (title, description, controls, tags, lobby sizes). Re-render them from gameplay with `node scripts/make-assets.cjs covers|video-landscape|video-portrait [--title "Name"]` while `npm start` is running.

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

## Combat notes

- Bullets collide with each other and cancel out with a small white puff.
- Railgun-class tanks fire a long neon beam that pierces shapes, tanks and bullets. Each target is hit once, and the beam loses 20% damage per target.
- Health bars show a short "damage trail" that drains after each hit.
- Spiked tanks: the spike tips deal damage too (they reach past the body), and ramming damage scales with the **Damage** stat instead of Body Damage.
- The spawn shield blocks damage but not attacking. Hurting another tank ends your own shield.
- **Recover Last:** when you die, your tank and stat points are saved (even across reloads). On your next spawn, one button restores them.

## Originality

Mechanics follow the genre, but names and art are this project's own. Tank display names, chest names, the prize wheel, chest artwork, icons and the lobby are original. Internal tank IDs are kept stable so saves stay compatible.
