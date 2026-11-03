# CrazyGames listing: Tank Rumble

Working title used on the covers: **Tank Rumble**. To use a different name, re-render the covers with
`node scripts/make-assets.cjs covers --title "Your Name"` (the server must be running: `npm start`).

## Assets (this folder)

| File | Size | CrazyGames field |
| --- | --- | --- |
| `cover-landscape.png` | 1920 x 1080 (16:9) | Landscape cover |
| `cover-portrait.png` | 800 x 1200 (2:3) | Portrait cover |
| `cover-square.png` | 800 x 800 (1:1) | Square cover |
| `preview-landscape.mp4` | 1920 x 1080, 18 s, H.264, no audio | Landscape preview video |
| `preview-portrait.mp4` | 1080 x 1620 (2:3), 18 s, H.264, no audio | Portrait preview video |

All five are rendered from real gameplay by `scripts/make-assets.cjs`.

## Basic info

- **Title:** Tank Rumble
- **Genre / category:** Shooting (alternatives: .io, Action)
- **Tags:** tank, multiplayer, io, 3d, shooter, pvp, upgrade, arena, team, bots
- **Orientation:** Landscape
- **Mobile:** Yes (touch joysticks, drag to turn the camera)
- **Multiplayer:** Yes. Lobby sizes: Battle (free for all) 10 players, Red VS Blue 10 players, 4 Teams 16 players (max 4 per team). Empty slots are filled by bots, so a match always starts instantly.
- **Ads:** None
- **In-game purchases:** None (gems are earned only by playing)

## Short description (one line)

Blast shapes, level up and evolve your tank through 50+ upgrades in fast 3D multiplayer battles.

## Description

Tank Rumble is a fast, colourful 3D tank arena. Drive into battle, destroy shapes for XP and grow from a
tiny cannon into a powerful war machine.

Every level gives stat points: boost damage, fire rate, bullet speed, health, regen, speed and more. As you
level up, evolve your tank down a huge upgrade tree: twin cannons, snipers, rapid-fire spammers,
flamethrowers, spiked rammers, railguns and rare special tanks.

Pick your fight:
- **Battle:** every tank for itself.
- **Red VS Blue:** team up. The first team to 25 kills wins the round.
- **4 Teams:** four-way chaos with up to 16 players.

Between matches, drive around the lobby to open shops and claim rewards. You can unlock skins, buy new tanks,
open chests, spin the wheel, climb the ranks and finish daily, weekly and event quests. Your progress is
saved to your CrazyGames account.

## Controls

**PC**
- WASD: move
- Mouse: aim
- Left click / Space: shoot
- Right-drag: turn and tilt the camera
- Scroll: zoom
- E then 1-8: upgrade stats
- Q: evolve your tank
- F: auto fire
- R: auto spin
- C: turn 180 degrees
- Shift: lock camera
- Enter: chat
- X: index
- G: gifts

**Mobile**
- Left joystick: move
- Right joystick: aim and shoot
- Drag anywhere else: turn and tilt the camera
- On-screen buttons: upgrades, auto fire, 180 turn

## Technical

- Engine: three.js (HTML5, WebGL), no external assets to load. The whole build is about 1 MB.
- CrazyGames SDK v3 features used:
  - Loading and gameplay start/stop, happytime.
  - User account: your CrazyGames username is shown in game, otherwise "Guest".
  - Cloud saves through the data module.
  - Invite link, invite button and invite parameters, instant multiplayer.
  - Mute and chat settings.
- Privacy Policy and Terms of Use are in Settings.

## Multiplayer server (needed for real players to meet)

CrazyGames hosts the game files only. For live multiplayer between real players:

1. Run `server/server.js` on a Node host (Render, Railway, Fly.io or any VPS; a `Dockerfile` is included).
2. Build with `node scripts/build.mjs --server wss://YOUR-HOST/ws`.
3. Upload `dist/tanks-crazygames.zip`.

Without a server the game still works, using full live servers in the browser with bots.
