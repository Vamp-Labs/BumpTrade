# BUMP.TRADE
# NEON MARKET ARENA — 3D ENVIRONMENT PRD

## 1. OBJECTIVE

Create the first production-ready 3D gameplay arena for BUMP.TRADE.

Arena name:

> NEON MARKET ARENA

The arena must communicate three things immediately:

1. Bumper-car attraction
2. Futuristic arcade
3. Stock-market / trading culture

Primary gameplay requirement:

> The arena must support fast collisions, chasing, drifting, money collection, wall bouncing, and ring-outs.

The environment must never reduce gameplay readability.

---

# 2. VISUAL TARGET

Style:

> stylized premium 3D + futuristic arcade + neon market

Reference feeling:

- bumper-car arena
- cyberpunk arcade
- trading floor
- amusement attraction
- premium multiplayer game

Avoid:

- realistic city environments
- realistic stock exchange architecture
- overly dark scenes
- maze-like level design
- excessive props
- excessive visual noise

The arena should feel like a purpose-built game level.

---

# 3. PRIMARY GAMEPLAY SPACE

Target playable area:

~40m × 40m

This is a starting target and can be adjusted after playtesting.

The central combat area must remain open.

The player should be able to:

- accelerate
- turn around
- chase
- line up an attack
- drift
- escape
- counterattack

without constantly hitting decorative objects.

---

# 4. ARENA STRUCTURE

The arena consists of these major systems:

1. Main Floor
2. Outer Bumper Wall
3. Margin Void
4. Margin Void Outer Frame
5. Electric Ceiling
6. Corner Structures
7. Market Screens
8. Neon Signage
9. Supporting Environment Props

Each system should be modular.

---

# 5. MAIN FLOOR

The floor is the primary gameplay surface.

Shape:

approximately square / rounded-square.

Surface:

dark industrial material.

Visual direction:

- dark graphite
- subtle reflections
- trading grid
- market graphics
- neon embedded lines

The floor must remain relatively flat.

Do not add decorative geometry that can unexpectedly affect vehicle physics.

---

# 6. FLOOR GRAPHICS

The floor visually references financial markets.

Possible graphics:

- subtle grid
- candlestick patterns
- directional arrows
- percentage symbols
- abstract chart lines
- bull icon
- small ticker numbers

Important:

These are environmental graphics only.

They do not represent live financial data.

The graphics should sit mostly inside the material/texture rather than being physical geometry.

---

# 7. CENTER FLOOR FEATURE

The arena should have one recognizable central graphic.

Concept:

> stylized bull / market symbol

It should be:

- large
- readable
- integrated into the floor
- primarily emissive or decal-based

It should NOT create a physical obstacle.

Purpose:

Create a recognizable BUMP.TRADE visual signature in gameplay clips.

---

# 8. OUTER BUMPER WALL

This is a gameplay-critical asset.

The outer wall should look like a real bumper-car wall.

Structure:

- dark metal frame
- thick rubber bumper
- neon lighting strip
- structural brackets

The wall must physically interact with cars.

Expected gameplay:

car hits wall

→ bumper compresses visually

→ car rebounds

→ sparks

→ slight camera shake

---

# 9. WALL DESIGN

Wall should have repeating modules.

Suggested modules:

WALL_STRAIGHT

WALL_CORNER

WALL_END

WALL_LIGHT

WALL_SUPPORT

This allows the arena to be assembled from reusable pieces.

Do not model the entire perimeter as one giant unique mesh.

---

# 10. WALL MATERIALS

### Rubber

Dark rubber.

High roughness.

Low metallic.

### Frame

Dark metal.

Medium/high metallic.

Medium roughness.

### Light strip

Emissive.

Primary:

orange / warm white

Secondary:

green / blue

The wall should remain visible even when the overall environment is dark.

---

# 11. MARGIN VOID

The Margin Void is the most important arena hazard.

Purpose:

> ring-out / liquidation

There should be approximately:

3–4 major void openings

around the arena.

Exact count can change after gameplay testing.

---

# 12. MARGIN VOID SHAPE

The void should be large enough for a bumper car to fall through.

Visual design:

- recessed pit
- dark internal walls
- red/orange glow
- downward energy
- warning signage
- particle effects

The void should look dangerous before the player interacts with it.

---

# 13. VOID GAMEPLAY BOUNDARY

Define clear gameplay zones:

SAFE

WARNING

VOID

The transition should be visually obvious.

Possible cues:

safe floor

→ warning strip

→ void edge

This prevents accidental confusion.

---

# 14. VOID DEPTH

The visible void should have enough depth to communicate falling.

It does not need physically infinite geometry.

Recommended approach:

- visible inner walls
- dark bottom
- fog
- particles
- emissive red lighting

The player only sees enough depth to sell:

> "I fell into the market void."

---

# 15. VOID ANIMATION

The void should remain subtly alive.

Procedural effects:

- particle movement
- vertical energy
- glow pulse
- downward arrows
- subtle fog motion

Avoid constant explosions.

The void should feel threatening, not noisy.

---

# 16. ELECTRIC CEILING

A traditional bumper-car arena uses overhead electricity.

This becomes a core BUMP.TRADE visual identity.

Create:

- ceiling grid
- electric rails
- support trusses
- hanging cables
- contact points
- hanging lamps
- electrical fixtures

The ceiling should visually connect with vehicle antennas.

---

# 17. CEILING HEIGHT

Starting target:

~8–10m above arena floor.

Enough clearance for:

- antenna
- camera
- visual composition

The ceiling should never interfere with vehicle gameplay.

---

# 18. ELECTRICAL SYSTEM

The ceiling should visually support the cars' antennas.

Components:

### Main Rails

Metal rails across ceiling.

### Contact Points

Multiple glowing connection points.

### Hanging Cables

Thin cables between structures.

### Electric Activity

Subtle sparks and arcs.

The final electrical animation will be implemented in Three.js.

---

# 19. ELECTRICAL MATERIALS

Rails:

dark metal

Contact points:

emissive green/blue

Small lamps:

warm orange

Electric arcs:

bright electric color

Do not make the entire ceiling emissive.

---

# 20. MARKET SCREENS

Environment contains several market-style digital screens.

Recommended:

- 1 large center screen
- 4–8 smaller supporting screens

Screens can display fictional information such as:

HOOD +2.8%

TSLA -1.2%

NVDA +3.4%

BUMP.TRADE

These are decorative game-world graphics.

Do not require a stock API.

---

# 21. SCREEN PLACEMENT

Screens should be primarily located:

- outside playable boundaries
- above bumper walls
- on pillars
- in spectator-facing positions

Do not put large screens directly in the player's driving path.

---

# 22. SCREEN ANIMATION

Screens can contain subtle motion:

- scrolling ticker
- changing graph lines
- blinking values
- animated background

Keep animations slow.

The game action remains the focus.

---

# 23. NEON SIGNAGE

Required:

### Main logo

BUMP.TRADE

### Margin Void

MARGIN VOID

### Direction signs

Arrows / warning markers

### Small environment signs

market-themed decorative signs

Signage should be modular.

---

# 24. CORNER STRUCTURES

Each major corner can contain a structural tower or pillar.

Functions:

- visual framing
- screen mounting
- cable support
- lighting support
- environment depth

Corners should not obstruct the arena.

---

# 25. ENVIRONMENT PROPS

Use a limited number of reusable props:

- digital terminals
- utility boxes
- cables
- pipes
- neon panels
- warning signs
- small arcade machinery
- barriers
- light posts
- crates / service boxes

Props should sit outside the core driving surface.

---

# 26. PROP DENSITY

The arena should feel alive without becoming cluttered.

Recommended principle:

> Empty center, detailed perimeter.

Approximately:

70% gameplay space

30% environmental framing

Do not cover the playable floor with decorative objects.

---

# 27. PBR MATERIAL LIBRARY

Create a small reusable material library.

### Floor

dark glossy industrial material

### Rubber

dark high-roughness bumper material

### Metal

dark painted metal

### Chrome

small amount of polished metal

### Glass

transparent dark glass

### Neon

emissive material

### Screen

emissive display material

### Concrete

secondary structural material

### Caution Stripe

yellow/black warning material

---

# 28. TEXTURE STRATEGY

Environment should use a modular texture strategy.

Avoid unique 4K textures for every prop.

Use:

- shared materials
- trim sheets
- atlases
- decals
- procedural masks

Large hero surfaces may use higher-resolution textures.

Small props should reuse texture assets.

---

# 29. FLOOR TEXTURE

Main floor texture should support:

- subtle grid
- market pattern
- worn industrial variation
- bull center graphic
- directional markings

Target:

clean enough for gameplay readability.

Do not use strong noise.

---

# 30. WALL TEXTURE

Wall texture should contain:

- industrial panel seams
- subtle scratches
- warning details
- mounting brackets
- material variation

Avoid overly realistic grime.

The environment should feel maintained and stylized.

---

# 31. SCALE REFERENCE

Use approximately real-world proportions.

Example:

Arena:

~40m × 40m

Wall height:

~1.2–1.8m

Ceiling:

~8–10m

Large screen:

~2–4m wide

Void width:

large enough for a vehicle

Exact dimensions are gameplay-tunable.

---

# 32. MODULAR ASSET STRUCTURE

Recommended asset modules:

arena_floor_tile.glb

arena_wall_straight.glb

arena_wall_corner.glb

arena_wall_end.glb

margin_void.glb

margin_void_frame.glb

ceiling_truss.glb

ceiling_rail.glb

electric_contact.glb

market_screen_large.glb

market_screen_small.glb

neon_sign.glb

pillar_structure.glb

environment_prop_set.glb

---

# 33. ASSET ORIGINS

Every modular asset must use predictable origins.

### Floor tile

origin at center

### Wall segment

origin at center / connection edge

### Corner wall

origin at connection corner

### Void

origin at gameplay center

### Ceiling module

origin at module center

This allows clean procedural assembly in Three.js.

---

# 34. MODULAR CONNECTIONS

Wall modules should connect without visible gaps.

Recommended:

straight wall length

=

repeating module size

Corner modules should align to the same grid.

Use a consistent arena construction grid.

---

# 35. THREE.JS SCENE ORGANIZATION

Suggested hierarchy:

ArenaRoot

├── GameplayFloor
│
├── BumperWalls
│
├── MarginVoids
│
├── Ceiling
│
├── Structures
│
├── Screens
│
├── Signage
│
├── Props
│
├── Lights
│
└── VFXPoints

Keep gameplay geometry separate from decoration.

---

# 36. PHYSICS GEOMETRY

The arena visual meshes should NOT automatically become physics meshes.

Create simplified physics representations for:

- floor
- bumper wall
- void boundary

Do not use complex decorative geometry as colliders.

The physics system should know only:

FLOOR

WALL

VOID

---

# 37. WALL PHYSICS

Wall collider should be:

simple

stable

predictable

Target behavior:

car enters wall

→ collision

→ bounce

No snagging.

No unexpected rotation.

No invisible collision protrusions.

---

# 38. VOID PHYSICS

The void should have clear gameplay detection.

Recommended:

void boundary trigger

rather than relying only on physical collision geometry.

When car crosses the trigger:

trigger:

LIQUIDATION

Then:

visual fall animation

---

# 39. LIGHTING DESIGN

Lighting has four major moods.

### Base

dark neutral environment

### Market Green

green accents

### Bumper Orange

warm wall lights

### Void Red

danger lighting

### Electric Blue

ceiling/electrical accents

These colors should create hierarchy.

---

# 40. GAMEPLAY LIGHTING PRIORITY

Priority:

1. cars
2. pickups
3. arena boundaries
4. Margin Void
5. walls
6. decorative screens
7. props

Do not allow environment lights to overwhelm the vehicles.

---

# 41. SHADOWS

Use shadows selectively.

Prioritize:

- hero car
- wall
- major structures

Avoid dozens of shadow-casting lights.

Browser performance is important.

---

# 42. NEON / BLOOM

Use subtle bloom.

Neon should glow.

But:

- cars must remain readable
- money pickups must remain readable
- void edges must remain readable

Do not wash the entire scene in bloom.

---

# 43. CAMERA TESTS

The arena must be evaluated from:

### Gameplay Camera

Primary view.

### Top View

For layout validation.

### Low Perspective

For environment quality.

### Opposite Side

For symmetry and framing.

The gameplay camera has the highest priority.

---

# 44. ARENA VISUAL COMPOSITION

The player should always have:

- clear center visibility
- visible opponents
- visible wall
- visible danger zones

Avoid large foreground objects blocking the screen.

Environment framing belongs mostly at the perimeter.

---

# 45. ARENA PERFORMANCE

Target browser performance:

60 FPS on modern desktop hardware.

Use:

- instancing
- shared materials
- texture atlases
- compressed textures
- limited dynamic lights
- pooled VFX
- simple colliders

Avoid:

- unnecessary 4K textures
- hundreds of unique meshes
- heavy transparency
- excessive real-time reflections
- excessive shadow maps

---

# 46. REFLECTIONS

Do not use expensive full-scene real-time reflections.

Use:

- environment maps
- baked/reflection textures
- selective screen-space effects if necessary

The cars should still feel glossy.

---

# 47. ENVIRONMENT ANIMATION

Environment animation should remain subtle.

Possible:

- ticker scrolling
- screen flicker
- neon pulse
- electrical sparks
- warning light pulse
- void energy movement

Do not animate every object.

---

# 48. WEATHER / EXTERNAL WORLD

Not required.

The game arena is an enclosed attraction.

Do not add:

- rain
- traffic
- pedestrians
- city streets
- outdoor weather

These dilute the bumper-car concept.

---

# 49. OPTIONAL SPECTATOR AREA

Can exist outside the gameplay boundary.

Use:

- rails
- signage
- screens
- lights

This area is optional.

Do not prioritize it over gameplay space.

---

# 50. ASSET NAMING

Use lowercase snake_case or the project's established convention.

Example:

neon_market_arena.glb

arena_floor_tile.glb

bumper_wall_straight.glb

margin_void.glb

ceiling_truss.glb

market_screen_large.glb

electric_contact.glb

Consistency is mandatory.

---

# 51. GLB REQUIREMENTS

Final environment assets must be:

- GLB/glTF
- correct scale
- correct orientation
- clean hierarchy
- optimized topology
- PBR-compatible
- Three.js compatible

Do not embed unnecessary hidden meshes.

---

# 52. ORIENTATION

World:

Y = up

Arena center:

0,0,0

Floor:

Y = 0

Keep a consistent world coordinate system.
