# TANKS — IMPROVEMENT BIBLE
## Product, visual identity, gameplay polish, architecture and implementation plan

**Purpose:** This document is the source of truth for improving this repository into a distinctive, polished 3D multiplayer tank arena. It uses broad genre-level inspiration from successful arena tank games, including the reference Roblox experience, but must not reproduce that game's protected expression.

**Important:** No redesign can guarantee immunity from a copyright, trademark, trade-dress, platform, or asset complaint. This bible is a practical originality and risk-reduction brief, not legal advice. Do not use another game's proprietary assets, code, UI screenshots as tracing templates, distinctive names, logos, exact layouts, or copied text. A disclaimer or a palette swap does not cure copying. Build a recognisably independent product. Obtain permission/licensing for any third-party material whose rights are unclear.

---

# 0. Claude's operating contract

You are the lead game designer, senior Three.js engineer, UX designer, and QA engineer for this repository.

1. **Read the existing implementation before editing.** Start with `README.md`, this bible, `public/js/main.js`, `public/js/game.js`, `public/js/lobby.js`, `public/js/render/*`, `public/js/ui/*`, `public/shared/*`, and `server/server.js`.
2. Preserve working gameplay, multiplayer, save compatibility, CrazyGames SDK integration, offline bot fallback, and mobile support unless a task explicitly changes them.
3. Do not make broad rewrites when incremental refactors are safer. Do not silently replace the authoritative shared simulation with client-side decisions.
4. Before editing, state the files to change, expected player-facing result, dependencies, and risks. Work in small coherent milestones.
5. After each milestone, run `npm test`; when networking changes, run `npm run start` and `node scripts/mp-test.mjs` against the local server. Add a focused test for each new shared mechanic.
6. Keep the browser console clean. Handle WebGL context loss, resize, tab visibility, disconnect/reconnect, asset failure, and reduced graphics gracefully.
7. Never invent that something was tested. Report the exact commands run and outcomes.
8. Keep a change log in the final response. Do not claim a full visual redesign from CSS-only tweaks.
9. Avoid leaking secrets, credentials, player identifiers, or server configuration. Keep deployment secrets out of the repository.
10. Do not add external assets or libraries without checking licensing, package size, offline behaviour, and CrazyGames compatibility.

## Definition of done
A milestone is complete only when:
- The game launches into the lobby without a broken/loading dead end.
- The requested path works in online and offline-with-bots modes where relevant.
- Keyboard, pointer, touch, and resize behaviour remain usable.
- Profile data survives reload and older saves still load.
- There are no uncaught errors, severe frame-time regressions, or obvious visual overlaps at desktop and portrait mobile sizes.
- Tests relevant to the change pass, and untested cases are named honestly.

---

# 1. What is in this repository today

This is a browser-based 3D game built with Three.js r160, native JavaScript ES modules, HTML/CSS, and a Node/WebSocket server. It is not a React app and should not be converted into one just to restyle it.

## Runtime architecture

- `public/index.html`: canvas, HUD root, modal root, touch root, SDK and CSS entry.
- `public/js/main.js`: application state, boot sequence, routing between lobby and arena, keyboard actions, animation loop, SDK/profile setup.
- `public/js/game.js`: arena lifecycle, online/offline connection, prediction/interpolation, tank/shape/bullet/particle views, combat events and HUD notifications.
- `public/js/lobby.js`: 3D lobby, player movement and proximity interactions.
- `public/js/input.js`: keyboard, pointer and touch input.
- `public/js/net.js`: WebSocket client and offline simulation adapter.
- `public/js/profile.js`: player persistence, progression, quests, daily systems, inventory and rewards.
- `public/js/render/models.js`: procedural tank and shape geometry, materials, health bars.
- `public/js/render/scene.js`: renderer, camera rig, arena/lobby environments.
- `public/js/render/textures.js`: procedural canvas textures and signs.
- `public/js/render/thumbs.js`: renders tank previews via a small Three.js renderer.
- `public/js/ui/hud.js`, `menus.js`, `icons.js`: DOM-based HUD, menus, SVG icons.
- `public/shared/config.js`, `tanks.js`, `world.js`, `progression.js`, `skins.js`, `filter.js`: shared simulation and data.
- `server/server.js`: authoritative rooms, fixed-rate simulation, bots, WebSocket protocol and static file server.
- `scripts/*`: build and simulation/combat/multiplayer smoke tests.

## Current strengths worth preserving

- A complete gameplay loop: lobby → arena → combat/farming → XP/gems → level and tank upgrades → return to lobby.
- Three match modes: free-for-all, two teams, and four teams.
- Data-driven tank definitions with a large upgrade tree and different barrel/body behaviours.
- One shared `World` simulation for server and offline play.
- Server-authoritative multiplayer with client prediction/interpolation and area-of-interest snapshots.
- Bot fill, invite-room support, mobile virtual controls, persistent progression and synthesised SFX.
- Procedurally generated tank icons and textures; no large external art dependency is required.
- Existing smoke tests for simulation and combat-leave behaviour.

## Current risks / technical debt to investigate

These are observations from the current source, not claims that every issue is a confirmed bug:
- The README openly describes the project as recreating the Roblox game's loop. Replace that framing with an independent product description.
- The stylesheet includes the comment `buttons (copied from the original)`; source comments also say the renderer is Roblox-style and tank thumbnails use the original's red body/light-blue barrels. Remove the copied-expression direction and replace with the art direction in this bible.
- Current UI uses repeated thick navy text outlines, highly saturated gradient buttons, familiar corner HUD clusters, and similarly framed hub/shop affordances. Do not assume each individual trait is protectable; the combined expression and explicit copying language are the concern. Redesign the overall composition and visual language together.
- The current 3D tank is a dome-like body with radial barrel attachments. This silhouette may be a genre convention, but avoid copying any exact reference tank model, proportions, skins, or named class designs. Evolve this game's own machine silhouette.
- Several names/classes and upgrade-tree concepts may overlap with well-known games or the reference. Perform a naming and branding audit before public release. Use original names and descriptions.
- `server/server.js` accepts player level, XP, multipliers, caps, skin and ownership from the joining client. Validate and bound all client-supplied values; do not trust client-side progression/economy in an authoritative multiplayer game.
- `profile.js` selects the save with the higher level/score between cloud/local copies. Review merge semantics and save migration carefully; a higher level is not necessarily the newest or internally consistent save.
- `game.js` and the DOM menu module are large and own many responsibilities. Avoid adding more tightly coupled logic; extract small focused modules behind stable interfaces.
- Check cleanup and disposal for all geometries, materials, textures, renderers, listeners, timers, animation callbacks, and WebSocket resources. Verify no duplicate UI listeners on repeated lobby/arena transitions.
- Verify websocket reconnect, stale room cleanup, duplicate join messages, oversized/untrusted messages, rate limits per message type, and disconnect race cases.
- Check whether `index.html` uses a remote Google Font. Provide a strong local/system fallback and ensure the game remains attractive offline; verify remote font licensing and loading policy.
- The build script copies all of `public`. Confirm no development-only files, source maps, debug endpoints, or secrets are accidentally shipped.

---

# 2. Original product positioning

## Working identity: **IRONWILD ARENA**
This is a working creative direction, not a final trademark-cleared name. Before adopting it publicly, search relevant game stores, domains, social platforms, and trademark databases, and get legal advice where needed. If unavailable, create a different name.

**Premise:** Custom-built combat machines compete in a bright, kinetic, modular arena. Players scavenge energy cores, dismantle rival machines, and evolve their loadout between rounds.

**Player promise:** Every match gives you immediate action, visible mastery, and a meaningful choice about how your machine develops.

**Design pillars**
1. **Readable chaos:** many projectiles and targets, but clear silhouettes, team colours, hit feedback and threat priority.
2. **Build expression:** machines look and play differently through original chassis, weapon modules, trails and paintwork.
3. **Short-loop reward:** hits, destruction, level-ups and unlocks each have distinctive audio/visual feedback.
4. **A living workshop:** a hub that feels like a place to tune and show off your machine rather than a collection of cloned shop pads.
5. **Fair competitive readability:** effects should never obscure aim, projectiles, health or the arena boundary.
6. **Fast entry:** no unnecessary account wall or title screen; load into the workshop and make the next action obvious.

Do not use another game's logo, name, screenshots, character/tank art, UI screenshots as tracing guides, proprietary audio, map geometry, wording, or extracted assets. Use references only to discuss high-level qualities such as readability, pacing and progression.

---

# 3. Visual identity system

## 3.1 Art direction: "bright industrial field science"

The game should feel like a playful experimental combat league—not a clone of a Roblox experience and not a generic military simulator.

- **World:** luminous test ranges, modular floating platforms, painted concrete, soft stylised terrain, giant mechanical set pieces, distant atmospheric structures.
- **Materials:** powder-coated metal, enamel, rubber, translucent polymer, ceramic armour and restrained emissive accents.
- **Shapes:** broad chassis plates, angled armour, asymmetrical module mounts, visible suspension details and deliberate negative space. Keep silhouettes unique per class.
- **Lighting:** clear bright key light, soft fill, readable contact shadows, subtle bounce colour, restrained bloom only on emissive objects. Avoid muddy dark scenes.
- **Surface detail:** large intentional panels and decals rather than noisy microtexture. Prioritise shape, value and silhouette over texture complexity.
- **Camera:** tactical elevated third-person view with stable follow smoothing. Preserve enough ground visibility to aim and navigate.
- **Effects:** stylised energy sparks, directional tracer streaks, short shock rings, fragments and dust puffs. Keep the screen legible.

## 3.2 Palette tokens

Create central design tokens in CSS and central shared 3D colour definitions. The following are starting points, not immutable values:

- Deep ink: `#17253A`
- Workshop background: `#E9EEF2`
- Panel surface: `#F7F9FA`
- Primary teal: `#177E89`
- Signal amber: `#F2B544`
- Coral warning: `#E66A58`
- Field green: `#56A978`
- Steel blue: `#66849B`
- Muted text: `#647384`
- White: `#FFFFFF`

Use colour semantically:
- Teal = primary action / selected / energy.
- Amber = currency / high-value reward / alert.
- Coral = damage / enemy / danger.
- Green = healing / confirmed / friendly.
- Neutral steel = structural surfaces and secondary content.

Team identity should use clear, colour-blind-aware combinations plus shape/icon cues. Do not rely on hue alone; add team symbols, outline patterns or labels.

## 3.3 Typography

- Replace the exaggerated, thick-outline display treatment with a restrained display face and highly legible UI face.
- Use a system-first font stack so the game looks intentional if remote fonts fail.
- Limit to 2 families and a small weight set.
- Use tabular numerals for XP, currency, timers, stats and damage.
- Avoid all-caps for long labels.
- Maintain contrast and readable sizes on phones.
- Do not choose a font solely because the reference uses a similar one.

## 3.4 Shape language and UI surfaces

Use a distinct design vocabulary:
- Panels: clean rectangular surfaces with 10–14px radii, thin borders, subtle elevation.
- Buttons: consistent height, clear icon + verb, single accent colour, strong focus/pressed states. No copied glossy gradient + thick black outline recipe.
- Cards: modular workshop cards with compact stats and a clear selected state.
- Icons: original, consistent stroke weight and geometry; do not trace reference icons.
- Motion: short ease-out transitions, spring-like reward response, subtle idle motion; respect reduced-motion preferences.
- UI hierarchy: one primary action per screen, secondary actions visually quiet, optional information progressively disclosed.

## 3.5 Three-dimensional tank design

Create a new machine family rather than repainting the current silhouette:
- Chassis should be a low-profile mechanical platform with a recognisable front/rear, track/wheel pods or hover assemblies, armour plates and a central reactor.
- Weapon modules are attachable, mounted on articulated hardpoints, and visibly distinct by role.
- Use 3–4 silhouette families first: agile scout, balanced platform, heavy siege, support/control.
- Give each family unique chassis proportions and movement animation—not just a different barrel count.
- Cosmetic skins should apply original material patterns, decals, emissive trims and small geometry accessories; avoid copying another game's skin names, patterns, exact colour arrangements or icons.
- Keep weapon count readable. A larger number of barrels must not turn into a noisy silhouette.
- Add a simple turntable preview in the Workshop with consistent lighting and camera framing.

**Implementation suggestion:** add `public/js/render/chassis.js` and `weapon-modules.js` only when the current model builder becomes hard to maintain. Keep a stable `buildTank(tankId, skinId, team, opts)` interface initially so gameplay code does not need a rewrite.

## 3.6 Arena environments

Build an original arena set around an identifiable theme:
- Initial recommended theme: **Helio Foundry**—a clean industrial energy-testing range with modular flooring, hazard rails, reactor pylons, suspended gantries and distant machinery.
- Replace the generic flat tiled plane as the only environmental identity with a small set of large, readable landmarks.
- Use a distinct centre objective/landmark and outer lanes to help navigation.
- Make boundaries obvious using rails, pylons, force-field beams or environmental silhouettes.
- Place destructible objects with clear value tiers and original shapes/materials. They should not be a direct copy of another game's food/shape set.
- Add variants later: overgrown scrapyard, frost reactor, storm platform. Each should use its own layout motifs and ambient palette while preserving competitive fairness.
- Do not reproduce maps, exact object placement, distinctive landmark combinations, or terrain silhouettes from the reference.

---

# 4. Screen-by-screen product redesign

## 4.1 Workshop / lobby

**Current:** compact 3D hub, flat metal walls, separate glowing pads around the room, portals at the rear.

**Target:** a believable open-air machine workshop with a central showcase platform and a clear navigation rail.

Layout:
- Centre: player's tank on a rotating inspection platform; idle animation and small status lights.
- Left: compact vertical navigation with Workshop, Garage, Research, Contracts, Collection.
- Right: player identity, level, currency and next unlock.
- Bottom/edge: one prominent **Deploy** action and a mode selector.
- World interactions may remain as optional shortcuts, but never be the only way to access essential features.
- Use a few large environmental silhouettes: crane, gantry, reactor tower, test track. Avoid clutter.
- Tank preview should be visible immediately and respond to equipped cosmetics.
- Add an intentional first-session hint sequence with a skip option.
- Provide a fast deploy flow; no title screen or sign-up gate.

## 4.2 Mode selection

Create a distinct mode selection screen/card group:
- Skirmish (solo free-for-all equivalent)
- Faction Clash (two-team equivalent)
- Quadfront (four-team equivalent)

These are working labels. Conduct a name/trademark audit before public adoption. Modes should have original descriptions and icons.
Show objective, team count, map, expected match pace and level requirement (if any). Keep the default path one click from the workshop.

## 4.3 Arena HUD

Rebuild hierarchy rather than moving existing buttons around:
- Top centre: compact level progress with a clear numeric level and subtle progress animation.
- Top-left: team/objective information and a compact match timer when relevant.
- Top-right: currency and match status, not a vertical wall of buttons.
- Bottom-left: movement/ability hints and mobile joystick zone.
- Bottom-right: aim/fire/utility controls for touch; desktop controls stay visually quiet.
- Context panel: tank modules or stat allocation appears only when requested, with a visible close affordance.
- Keep chat and player list secondary and collapsible.
- Add a clear damage/health indicator near the player, but do not cover action space.
- Use consistent safe-area insets and prevent controls from covering the arena centre.
- The own tank, allies, enemies and neutral targets must remain distinguishable without reading text.

## 4.4 Garage / research

Turn tank upgrades into an understandable research/assembly presentation:
- Show current chassis and next available module choices.
- Each option includes a clear silhouette, role, trade-off and unlocked-at condition.
- Compare only the stats that change; use deltas and small bar/radar comparisons.
- Show mutually exclusive branches clearly.
- Provide a test-preview rotation and firing preview where practical.
- Never use another game's tank names, icons, descriptions, exact branch graph or branded terminology.
- Audit all existing tank names and descriptions; rename any term that creates confusion or appears tied to the reference. Preserve stable internal IDs where possible to avoid breaking saves.

## 4.5 Rewards and progression

- Give XP, credits and unlock progress distinct icons and colour.
- Reward panels should answer: what did I earn, why, what changed, what can I do next?
- Avoid opaque RNG as the sole route to important gameplay power.
- If crates/random rewards remain, disclose odds and keep the mechanic compliant with platform policies and applicable laws.
- Prefer deterministic milestones and gameplay-earned currency.
- Daily/weekly goals should reward varied play, not force unhealthy grind or punitive streak loss.
- Do not use fake scarcity, deceptive timers, misleading purchase affordances or artificial dark patterns.

---

# 5. Combat and feel

The basic loop is promising. Improve the sensory feedback and clarity without changing balance accidentally.

## 5.1 Combat readability

- Every projectile family gets a distinct silhouette/trail and impact treatment.
- Allied/enemy projectiles must be immediately distinguishable.
- Add a small directional hit indicator, damage flash and brief target feedback.
- Use short recoil, barrel kick, chassis compression, hit-stop (very brief) and impact particles.
- On destruction, use a distinct sequence: flash → fragments → fade/cleanup; avoid huge opaque explosions.
- Do not put critical gameplay information behind bloom, fog, glow or particles.
- Add damage numbers only if they can be kept readable and performant; provide a reduced-effects setting.
- Spawn protection should be visible and understandable, not an ambiguous invulnerability exploit.
- Aim indicators and range cues must match actual gameplay geometry.

## 5.2 Sound

Current sound is synthesised in `public/js/audio.js`, which is a good zero-download baseline.
- Create distinct sound families for light/heavy shots, impacts, armour break, pickups, upgrades, UI focus and match events.
- Keep high-frequency spam under control. Rate-limit repetitive effects and mix by distance/importance.
- Add a master volume and SFX volume if music is introduced.
- All sound must be original or appropriately licensed. No ripped sounds or soundalikes designed to mimic a specific game's signature cues.
- Respect muted settings and browser audio unlock requirements.

## 5.3 Balance and meta

- Do not rebalance tank damage, stats, XP curves, cooldowns, health, or gem values as part of a visual-only milestone.
- Build a balance spreadsheet/test harness before economy changes.
- Track pick rate, kill/death, average damage, time-to-kill, time-to-first-upgrade and progression time by tank tier.
- Aim for viable choices, not one dominant build.
- Make each module's strength and weakness legible.
- Validate progression pacing at low, mid and high levels using scripted simulations.

---

# 6. Technical implementation rules

## 6.1 Keep simulation authoritative

- `public/shared/world.js` remains the source of truth for combat and movement in both the Node server and offline mode.
- Client can predict local motion for responsiveness, but server snapshots reconcile it.
- Never trust client-provided gems, XP, unlock ownership, rank, multipliers, stat caps or tank IDs as authoritative values in a competitive server.
- Introduce server-side identity and progression validation before adding monetised or valuable inventory.
- Validate finite numbers, ranges, enums, strings and array sizes on every WebSocket message.
- Add per-message rate limits, join limits, server message-size limits and safe error handling.
- Avoid exposing hidden bot state or unnecessary player data in snapshots.

## 6.2 Visual performance

- Continue using InstancedMesh for repeated shapes, bullets and particles.
- Reuse geometries/materials; avoid allocating objects in the hot update loop.
- Pool frequently spawned particles/projectiles and cap them by quality setting.
- Use a fixed internal render quality profile with device pixel ratio caps.
- Consider shadows on a small subset of important objects, not every particle.
- Avoid expensive dynamic canvas textures per frame.
- Use frustum culling and area-of-interest rendering where it helps.
- Dispose resources on arena/lobby transition and when replacing tank views.
- Add a performance HUD behind a debug toggle: FPS, frame time, draw calls, triangles, active meshes, particles, ping and snapshot size.
- Profile low-end integrated GPUs and mobile browsers before adding post-processing.

## 6.3 Responsive UX

Test at minimum:
- 1920×1080 desktop
- 1366×768 laptop
- 1024×768 tablet landscape
- 390×844 phone portrait
- 844×390 phone landscape

Use CSS safe-area insets, clamp-based sizing, responsive panel limits and touch target sizes around 44px or larger. On portrait, prioritise playfield and controls. Keep pinch/scroll behaviour intentional. Ensure pointer lock is optional and recoverable.

## 6.4 Accessibility and comfort

- Add reduced-motion support.
- Ensure text contrast and readable UI scale.
- Pair team colours with labels/icons/patterns.
- Avoid flashing effects that may cause discomfort.
- Provide independent SFX and music toggles/volume.
- Make focus/selected/disabled states obvious.
- Allow camera sensitivity and graphics quality settings to persist.
- Provide low-effects mode and stable frame-rate mode.

## 6.5 Save compatibility

- Never casually change existing save keys or object structure.
- Add an explicit save schema version and migrations.
- Test loading current saves, empty saves, malformed JSON, partial cloud saves and old versions.
- Do not assume highest level means the most valid save. Merge carefully with timestamps and field-level validity.
- Keep local fallback when SDK/cloud is unavailable.
- Avoid granting currency/XP more than once during retries or double-clicks.

---

# 7. Intellectual-property and originality checklist

This section is mandatory before public release.

## Do not do these things
- Do not use extracted Roblox game meshes, textures, icons, sprites, screenshots, audio, source code or other proprietary assets without permission.
- Do not trace/recreate its UI screen-by-screen or reproduce its exact visual composition.
- Do not copy names, descriptions, logos, distinctive map layouts, tank silhouettes, upgrade-tree presentation, shop art or signature reward presentation.
- Do not use the reference game's title, logo, branding, or confusingly similar game title in your branding, icon, metadata, advertisements or thumbnails.
- Do not write "recreation", "clone", or "exactly like [reference]" in public store descriptions.
- Do not rely on flipping, recolouring, mirroring, resizing, or slightly altering a copied asset as a workaround.
- Do not assume that an asset being visible in a public game or uploaded to the web means it is free to reuse.

## Required workflow for originality
1. Create a reference log that records only high-level genre observations (e.g. readable projectiles, short upgrade decisions, visible level progress). Do not save reference screenshots as tracing templates.
2. Design new UI wireframes from this product's own information hierarchy.
3. Create original tank silhouette sheets with different chassis proportions, module locations, front/rear details and class language.
4. Create original arena blockouts with different landmark shapes, routes and object placement.
5. Make a fresh icon set and original audio palette.
6. Keep provenance for every external font, model, texture, sound and code dependency. Record the licence and source URL.
7. Search the final name and prominent class/mode names for conflicts. Check trademarks, game listings, domains, social platforms and applicable jurisdictions.
8. Review marketing images and gameplay footage for accidental use of third-party marks or assets.
9. If a reference element is essential to the desired product, seek permission/licensing or redesign it.
10. Keep records of original source files and design iterations.

**Legal caveat:** Copyright, trademark, trade dress, game-platform rules and other rights vary by jurisdiction and facts. A game can still receive a complaint even if the developer believes it is sufficiently different. For meaningful commercial exposure, obtain advice from a qualified IP lawyer. No automated checklist guarantees no strike.

---

# 8. Prioritised implementation roadmap

Work in the sequence below. Do not start every phase at once.

## Phase 0 — Baseline and risk audit
**Goal:** understand what exists and avoid breaking it.
- Run `npm test`.
- Launch locally and capture baseline screenshots/video of lobby, arena, menus, tank preview and mobile layout.
- Record FPS, draw calls, triangle count, active particles, snapshot size and ping.
- Audit all current names, icons, CSS, comments, tank silhouettes, arena structures and marketing assets for reference-specific expression.
- Replace README positioning with an accurate independent description.
- Remove copied-from-original comments and write neutral implementation descriptions.
- Create a save schema/version plan and security backlog.
**Acceptance:** baseline documented, tests pass, risk list created, no feature changes accidentally bundled.

## Phase 1 — Visual system foundation
**Goal:** establish an original identity before polishing individual screens.
- Add central CSS tokens and 3D palette constants.
- Redesign typography, button system, panel system, selected states, spacing and icon rules.
- Remove the oversized outline text treatment and glossy button recipe.
- Create an original icon family; retain existing icon API where possible.
- Improve local font fallback and loading resilience.
**Acceptance:** HUD and menu components look like one coherent product; no reference screenshot is needed to explain the direction.

## Phase 2 — Workshop and menu redesign
**Goal:** make the first 15 seconds polished and obvious.
- Redesign `buildLobby` and `lobby.js` around the Workshop/inspection platform concept.
- Redesign `hud.js` lobby state and `menus.js` primary navigation.
- Keep quick access to garage, research, contracts, collection and deploy.
- Add responsive and touch checks.
**Acceptance:** a new player can inspect their machine, understand currency/progression and deploy without confusion.

## Phase 3 — Arena environment and machine silhouette
**Goal:** own the 3D identity.
- Build the Helio Foundry theme and original landmark silhouettes.
- Rework tank chassis proportions and module attachment system.
- Add 3–4 distinct chassis archetypes with original idle/movement animation.
- Improve material response and lighting without overloading GPU.
- Create a consistent tank turntable preview and generated icons.
**Acceptance:** screenshots of the lobby, arena and tank lineup are visually distinctive and consistent; low-quality setting remains playable.

## Phase 4 — Combat feedback polish
**Goal:** make every interaction feel deliberate.
- Improve muzzle flash, recoil, projectile trails, impact particles, damage response, destruction and pickup feedback.
- Redesign health/target indicators and hit direction cues.
- Add sound variety and mix limits.
- Add reduced-effects mode.
**Acceptance:** combat remains readable during high projectile density and effect overload tests.

## Phase 5 — Progression and garage UX
**Goal:** make the large content system understandable.
- Rework the tree as research branches and modular assembly.
- Improve stat comparisons, descriptions and unlock previews.
- Make reward screens legible and satisfying.
- Audit naming and descriptions.
- Balance only after recording current economy and regression tests.
**Acceptance:** players understand what each choice changes and can distinguish meaningful alternatives.

## Phase 6 — Multiplayer integrity and performance
**Goal:** harden the game for public traffic.
- Validate join payload and all messages server-side.
- Move valuable progression authority to server-backed persistence before introducing purchases/trading.
- Add reconnect, stale room, message flood, malformed payload and room overflow tests.
- Profile CPU/GPU/network under full rooms and high projectile counts.
- Check memory leak behaviour through repeated lobby/arena transitions.
**Acceptance:** automated tests cover common abuse/failure paths; multiplayer stays smooth under expected player counts.

## Phase 7 — Release readiness
- Cross-browser and device testing.
- CrazyGames SDK compliance and offline-mode check.
- Asset licence/provenance audit.
- Trademark/name search and marketing review.
- Save migration and backup verification.
- Build-size and load-time review.
- Verify no secrets or debug endpoints in distributable.
**Acceptance:** release checklist completed with evidence, not assumptions.

---

# 9. Detailed file ownership map

| File | Primary responsibility | Safe direction |
|---|---|---|
| `public/css/style.css` | UI design system and responsive layout | Replace copied visual recipe with original tokens/components; retain functional selectors until consumers migrate |
| `public/js/ui/icons.js` | UI icon primitives | Original consistent icon set; preserve icon API |
| `public/js/ui/hud.js` | Arena/lobby HUD | Recompose hierarchy and improve safe areas; keep callbacks and state flow stable |
| `public/js/ui/menus.js` | Modal/shop/quest/garage screens | Modularise gradually; redesign composition and terminology |
| `public/js/render/models.js` | Tank/shape meshes and bars | Original chassis/module system; preserve `buildTank` contract initially |
| `public/js/render/scene.js` | Renderer, camera, environments | Workshop and arena identity, lighting and performance |
| `public/js/render/textures.js` | Procedural textures | New material palette and original patterns |
| `public/js/render/thumbs.js` | Tank thumbnails | Match new chassis identity and preview lighting; fix cleanup/cache limits if needed |
| `public/js/lobby.js` | Lobby simulation and interactions | Workshop flow, interaction prompts, camera and movement |
| `public/js/game.js` | Arena view and client prediction | Combat feel, view pooling, clear separation of rendering from simulation |
| `public/js/main.js` | Application lifecycle | Keep boot, state routing and SDK transitions stable |
| `public/shared/tanks.js` | Tank definitions | Rename public-facing classes safely; maintain stable IDs/migration aliases |
| `public/shared/config.js` | Shared simulation constants | Keep balance changes separate from visual milestones |
| `public/shared/world.js` | Deterministic authoritative simulation | Validate rules and add focused tests; no client trust |
| `public/js/profile.js` | Persistent progression | Schema version, migration, save integrity and idempotent rewards |
| `server/server.js` | Multiplayer authority | Validate inputs and defend rooms/messages |
| `scripts/*` | Build/test automation | Expand regression coverage per milestone |

---

# 10. QA matrix

At every milestone, test the applicable rows:

| Scenario | Expected |
|---|---|
| Fresh save | Starts in Workshop with valid default machine and no errors |
| Existing save | Loads without losing level, currency, ownership or settings |
| Corrupt/partial save | Recovers safely and logs a useful diagnostic |
| Offline server unavailable | Bots still fill a playable match |
| Online room join | Correct mode/room, player appears once |
| Invite room | Invite parameter joins intended room when capacity allows |
| Full room | Overflow uses a new room; no player is stranded |
| Disconnect | Player is removed and room cleanup works |
| Mid-combat leave | Existing combat-leave rule remains correct |
| Repeated arena/lobby transitions | No duplicate listeners, timers, meshes or growing memory |
| High projectile density | No severe frame-time collapse or unreadable effects |
| Low graphics | Playable, reduced shadows/effects, correct controls |
| Touch portrait | Safe areas respected; controls don't cover central target zone |
| Touch landscape | UI remains readable and action controls remain reachable |
| Keyboard/mouse | Existing movement, aiming, firing and panels still work |
| Muted audio | No sound plays after settings/SDK mute |
| Tab hidden/restored | Save and timing behaviour remain safe |
| Resize | Camera and UI adapt without stretched canvas |
| Build output | Correct server config, assets and no secrets |

Commands:
```bash
npm install
npm test
npm start
node scripts/mp-test.mjs
npm run build -- --server wss://YOUR-SERVER/ws
```

Do not run the multiplayer test without a server running. Do not commit deployment secrets or a real production endpoint unless specifically intended.

---

# 11. Claude task template

For every future implementation request, use this structure:

**Objective**
Describe the player-facing problem and desired outcome.

**Existing behaviour**
Trace the current code path and list the files/functions involved.

**Design**
Describe the new original visual/interaction result. Do not cite a reference screen as a template.

**Implementation**
List small changes by file. Preserve stable APIs where possible.

**Compatibility**
Explain save, online/offline, mobile, SDK and rendering implications.

**Tests**
Add/update automated tests and list manual test steps.

**Acceptance criteria**
Use observable conditions, including a screenshot or recording for visual work.

**Report**
Summarise exact files changed, tests run, known limitations and any follow-up debt.

---

# 12. First concrete task for Claude

Do not immediately repaint every button. Begin with a **Phase 0 originality and baseline audit**.

1. Read this entire bible and the code paths in Section 1.
2. Run the current tests and report exact results.
3. Make a table of every screen and major visual component, describing current composition and proposed original replacement.
4. Audit all tank names, skin names, mode names, icon concepts, CSS comments and README language for reference-specific wording or expression. Flag uncertainty rather than declaring legal conclusions.
5. Identify which current mechanics are generic genre conventions and which presentations need the most redesign.
6. Produce a visual moodboard in words and a screen-by-screen wireframe specification for the Workshop, Arena HUD, Garage, Research and reward screens.
7. Recommend a low-risk sequence of files to change.
8. **Do not modify gameplay balance or save formats in this first task.**
9. Do not copy any screenshot, asset, code or exact layout from the reference game.
10. Wait for the audit to be completed before starting Phase 1.

The objective is not to disguise a clone. It is to make a genuinely original tank arena game that is just as immediately readable, satisfying and compelling.
