Ya. Saya sudah lihat **current car yang berhasil dibuat** dari screenshot. Menurut saya fondasinya sudah ada, tetapi bentuknya masih terlalu **boxy / flat / futuristic platform**, sementara target visual yang kita sepakati adalah **compact premium bumper car** yang lebih bulat, berisi, dan langsung terbaca sebagai mobil bom-bom car.

Yang sudah bagus dari current:
- bumper ring sudah terlihat
- antenna sudah ada
- lampu/emissive sudah kuat
- warna hijau sudah mengarah ke target
- overall proportion cukup lebar untuk bumper car

Yang perlu dikoreksi:
- body terlalu tipis dan persegi
- hood/front masih seperti platform datar
- cockpit belum terasa sebagai body mobil
- side silhouette belum punya volume
- bumper terlalu seperti ring terpisah dari body
- wheel integration belum menyatu dengan body
- antenna/contact head terlalu besar dan terlalu terang
- texture masih sangat generik
- belum ada identitas **HOOD BULL**
- belum ada material separation yang jelas antara paint, rubber, metal, glass
- dari gameplay camera, bentuknya belum punya silhouette yang ikonik

Jadi saya akan berikan PRD yang sifatnya **corrective PRD**: agent tidak membuat asset lain, tetapi **memperbaiki asset sekarang sampai mendekati reference yang sudah kita sepakati**.

---

# BUMP.TRADE — HOOD BULL
## CAR SHAPE + TEXTURE CORRECTION PRD

### 1. PURPOSE

Refine the existing HOOD BULL 3D vehicle instead of creating an unrelated new vehicle.

The current implementation already contains:

- vehicle chassis
- bumper ring
- wheels
- antenna
- headlights
- emissive lighting

Keep the existing technical foundation where possible.

The goal is to transform the current model into:

> a premium stylized futuristic amusement-park bumper car with a compact sports-car silhouette.

Reference hierarchy:

**Bumper Car first**  
**Sports car second**  
**Stock-market theme third**

The vehicle must immediately read as a bumper car.

---

# 2. CURRENT ASSET ASSESSMENT

Current model direction:

- wide horizontal platform
- low body
- large front/rear bumper ring
- strong green emissive accents
- oversized antenna
- minimal cockpit volume
- simplistic body geometry

Current problems:

### Shape

The current body is too rectangular.

It currently reads closer to:

> futuristic platform / hover vehicle

Target should read:

> premium bumper car

### Volume

The body needs substantially more vertical and curved volume.

### Front

The front should have:

- hood/body volume
- windshield/cockpit transition
- headlights integrated into fascia
- bumper integrated into body

### Side

The side needs:

- visible cabin volume
- wheel arches
- body panels
- side contour
- bumper connection

### Rear

The rear needs:

- clear trunk/rear body
- taillights
- rear fascia
- bumper integration
- money display housing

---

# 3. TARGET SILHOUETTE

The target silhouette is:

```text
             ANTENNA
                 │
                 │
          ┌────────────┐
       ┌──┘   COCKPIT  └──┐
     ┌─┘                  └─┐
    │       BODY / HOOD      │
    │                        │
    └───────┐        ┌───────┘
            │ BUMPER │
       ─────────────────────
```

From top-down:

- rounded front
- rounded rear
- wide center
- visible cockpit
- strong circular bumper
- wheels partially exposed

Avoid:

- rectangular slab
- flat top
- excessive sharp corners
- box-shaped chassis
- detached bumper ring

---

# 4. BODY PROPORTION

Use the following as starting proportions:

Length:

~2.6 m

Width:

~1.9 m

Main body height:

~1.05–1.25 m

Overall vehicle including antenna:

~2.5–3.0 m depending on antenna

Bumper diameter/width:

~2.0–2.2 m

The body should occupy more visual volume than the current version.

The bumper remains large, but must visually wrap around the body.

---

# 5. BODY SHAPE

The main body should have:

### Front

- slightly rounded nose
- sloped hood
- integrated headlights
- central identity/decal
- lower grille

### Mid

- raised cockpit
- compact driver's area
- curved side shoulders
- side panels

### Rear

- elevated rear body
- taillights
- money display
- rear bumper connection

Use smooth curved surfaces.

Avoid excessive sharp industrial edges.

---

# 6. COCKPIT

The current cockpit needs to become a proper vehicle cabin.

Add:

- seat
- dashboard
- windshield/canopy
- side cockpit walls

The cockpit should NOT look like a traditional full-size car interior.

Target:

> amusement bumper-car cockpit with futuristic styling

The driver compartment can remain visually simple because gameplay camera is relatively distant.

---

# 7. WINDSHIELD / CANOPY

Use a dark transparent or semi-transparent material.

Shape:

- curved
- low
- compact

Do not create a giant windshield.

The canopy should emphasize the compact bumper-car body.

---

# 8. BULL IDENTITY

HOOD BULL needs a visual identity.

Do NOT turn the vehicle into a literal bull.

Use subtle bull motifs.

Primary:

**stylized bull-head mark**

Possible locations:

- front center
- hood
- side panel
- wheel center

Secondary:

- horn-inspired body contours
- bullish arrow motif
- small market chart decal

The bull identity must be visible but premium.

---

# 9. FRONT FASCIA

The current front should be remodeled.

Required:

### Headlights

Two aggressive compact headlights.

### Central panel

Small bull emblem.

### Lower intake

Dark grille / vent.

### Bumper connection

The bumper should appear integrated with the front chassis.

The bumper should not visually float.

---

# 10. BUMPER

Keep the bumper concept from the current implementation.

However:

### Current problem

It looks like an independent ring.

### Target

It should look mechanically attached.

Add:

- bumper mounts
- support brackets
- body transition
- subtle rubber compression zones

The bumper itself should be:

dark rubber

with:

small metallic frame

and optional neon accent.

The neon should NOT cover the entire bumper.

---

# 11. WHEELS

The wheels need stronger integration with the body.

Target:

- 4 visible wheels
- partially exposed
- rounded wheel arches
- dark rubber
- metallic rim
- small green emissive detail

Wheel size:

approximately 0.55–0.65m diameter starting point.

Do not make wheels too small.

The wheel should contribute to the bumper-car silhouette.

---

# 12. WHEEL ARCHES

Add physical body cutouts/arches around each wheel.

This will eliminate the current:

> "box on top of wheels"

appearance.

Body should wrap around wheel positions.

---

# 13. ANTENNA

The antenna is currently too visually dominant.

Reduce:

- ring diameter
- bloom intensity
- visual thickness

Target:

thin metal antenna

+

small contact head

+

controlled electric glow

The antenna should be obvious without becoming the main object in the frame.

---

# 14. CONTACT HEAD

The top contact element should be:

- compact
- recognizable
- metallic
- emissive around its edge

Avoid a giant bright white disc.

Target appearance:

> small glowing electrical contact

not:

> giant sci-fi portal.

---

# 15. ANTENNA BASE

Add a physical antenna mount.

Current antenna appears to emerge directly from the body.

Add:

- mechanical base
- small housing
- cable/connection detail

This will make the object feel physically believable.

---

# 16. REAR DESIGN

The rear needs to become more car-like.

Required:

- rear body volume
- taillights
- rear panel
- money display
- bumper
- exhaust/vent styling

The money display should be embedded into the rear fascia.

Do not place it as a floating screen.

---

# 17. MONEY DISPLAY

Create an integrated rear digital display.

Shape:

wide rounded rectangular display.

Housing:

dark metallic frame.

Screen:

dark glass/emissive.

Runtime value:

`$85`

Do not permanently bake `$85` into the model texture.

The number must be dynamically rendered by Three.js.

---

# 18. SIDE PROFILE

This is one of the most important corrections.

Side profile must contain:

- front volume
- cockpit
- rear body
- visible wheels
- bumper
- side decal

The current side profile is too flat.

Add a subtle upward shoulder line toward cockpit/rear.

---

# 19. SIDE DECAL

Add a small premium bull/market graphic.

Example:

stylized bull icon

+

small upward arrow

+

micro market line

Do not cover the entire side with graphics.

Target:

> collectible game skin

not:

> advertisement billboard

---

# 20. BODY SURFACE

Body should use smooth curved surfaces.

Use bevels generously.

Avoid razor-sharp edges.

The car should catch light along:

- hood
- shoulders
- fenders
- rear body

These highlights are critical for the premium appearance.

---

# 21. EDGE TREATMENT

Major edges:

small bevel

Medium edges:

soft bevel

Small decorative edges:

sharp enough to hold highlight

The current model is too geometrically flat.

The new body must produce natural highlights.

---

# 22. MATERIAL SYSTEM

Create the following separate materials.

### 01 BODY_PAINT

Green metallic paint.

High/medium metallic.

Low/medium roughness.

Clearcoat.

### 02 DARK_METAL

Chassis and mechanical parts.

Dark metallic.

Medium roughness.

### 03 RUBBER

Bumper + tires.

Non-metallic.

High roughness.

### 04 GLASS

Cockpit/windshield.

Dark transparent glass.

Low roughness.

### 05 CHROME

Small trim areas.

Highly metallic.

Low roughness.

### 06 EMISSIVE_GREEN

Electric/green lights.

Controlled emission.

### 07 EMISSIVE_WHITE

Headlights / display accents.

Bright but not blown out.

---

# 23. GREEN BODY COLOR

Do not use a flat green.

Target:

dark green shadow

→ rich emerald midtone

→ bright green highlight

Suggested visual direction:

deep emerald / racing green.

The green paint should look expensive.

---

# 24. ROUGHNESS VARIATION

Body must not have uniform roughness.

Add subtle variation.

Examples:

hood:

glossy

side panel:

slightly less glossy

lower body:

slightly rougher

bumper:

very rough

glass:

smooth

metal:

medium

This makes the asset visually rich without requiring excessive polygons.

---

# 25. METALLIC VALUE

Use metallic carefully.

Body:

metallic paint behavior

Bumper:

0 metallic

Rubber:

0 metallic

Tire:

0 metallic

Chassis:

high metallic

Chrome:

1 metallic

Do not make the entire vehicle metallic.

---

# 26. TEXTURE DETAIL

Add subtle details:

- seams
- vents
- panel lines
- tiny screws
- mechanical brackets
- bumper mounting points

But keep them subtle.

Gameplay camera should still read the major shape first.

---

# 27. DECAL SYSTEM

Use separate decals/material layer where practical.

Required decal categories:

BULL_ICON

MARKET_ARROW

MICRO_CHART

BUMP_TRADE_MARK

Do not bake all identity graphics into the base body mesh.

This allows future skin variants.

---

# 28. TEXTURE RESOLUTION

Hero body:

2048×2048 minimum

Can move to:

4096×4096

ONLY if required for close-up quality.

Do not make 4K the default requirement.

Browser optimization is important.

---

# 29. UV

Re-unwrap if necessary.

Highest UV density:

- front hood
- headlights
- side panels
- rear money display
- bull emblem

Lower density:

- underside
- hidden chassis
- internal areas

Avoid stretched UVs.

---

# 30. TEXTURE MAPS

Target:

BaseColor

Normal

Roughness

Metallic

Emissive

AO

Optional packed maps for WebGL optimization.

---

# 31. EMISSIVE CONTROL

Current screenshot has excessive green bloom.

Reduce it.

The green body itself should remain visible as paint.

Emission should only emphasize:

- headlights
- antenna
- money display
- thin accent strips

The car should NOT become a green glowing silhouette.

---

# 32. LIGHTING COMPATIBILITY

The car must look good under:

neutral white light

green market light

red danger light

blue night light

Do not build the material to work only under green lighting.

The base material needs to remain attractive under neutral lighting.

---

# 33. DAMAGE / GAMEPLAY VISUALS

Do not permanently alter textures during normal collisions.

For collision:

use runtime VFX:

- sparks
- flash
- temporary emissive pulse
- smoke

Later we can create cosmetic damage states.

---

# 34. MODEL HIERARCHY

Final asset should aim for:

HOOD_BULL_ROOT

├── BODY
├── CHASSIS
├── BUMPER
├── COCKPIT
│   ├── SEAT
│   ├── WINDSHIELD
│   └── DASHBOARD
│
├── WHEELS
│   ├── WHEEL_FL
│   ├── WHEEL_FR
│   ├── WHEEL_RL
│   └── WHEEL_RR
│
├── LIGHTS
│   ├── HEADLIGHT_L
│   ├── HEADLIGHT_R
│   ├── TAILLIGHT_L
│   └── TAILLIGHT_R
│
├── ANTENNA
│   ├── SHAFT
│   ├── MOUNT
│   └── CONTACT_HEAD
│
├── MONEY_DISPLAY
│
├── DECALS
│
└── VFX_SOCKETS
    ├── IMPACT
    ├── BOOST
    ├── SKID
    └── MONEY

Exact hierarchy may adapt to the existing model.

---

# 35. PIVOT REQUIREMENTS

BODY:

center of vehicle

WHEELS:

center of axle

ANTENNA:

base

BUMPER:

mechanical mounting point

MONEY_DISPLAY:

center

VFX sockets:

exact attachment positions

Do not compensate for incorrect Blender pivots with arbitrary Three.js offsets.

Fix the asset source.

---

# 36. GAMEPLAY CAMERA TEST

The model is NOT approved from Blender beauty view alone.

Test:

### 1. Close-up

Check material quality.

### 2. Side

Check silhouette.

### 3. Top

Check gameplay readability.

### 4. Gameplay distance

Check whether:

- bumper is visible
- antenna is visible
- money display is visible
- wheels are distinguishable
- body remains readable

### 5. Multiple cars

Duplicate the car 4 times.

Check whether each still reads clearly.

---

# 37. CURRENT MODEL → TARGET MODEL

## KEEP

- bumper ring concept
- wide stance
- green color
- antenna concept
- emissive lights
- four-wheel layout

## MODIFY

- body volume
- hood
- cockpit
- windshield
- wheel arches
- bumper integration
- rear fascia
- money display housing
- antenna size
- material separation
- decal system

## REDUCE

- excessive emissive bloom
- oversized contact head
- flat rectangular panels
- unnecessary glowing surfaces

## ADD

- bull identity
- curved automotive body
- proper cabin
- fenders
- rear volume
- bumper mounts
- panel seams
- premium PBR material variation

---

# 38. TARGET SILHOUETTE PRIORITY

When comparing current vs reference, prioritize in this exact order:

1. overall silhouette
2. bumper shape
3. cockpit/body volume
4. wheel placement
5. antenna proportion
6. front/rear identity
7. material separation
8. decals
9. micro details

Do NOT try to fix micro-textures before the silhouette is correct.

---

# 39. DEVELOPMENT APPROACH

Do not throw away the current asset automatically.

Use the current implementation as the base where useful.

Recommended process:

### PASS 1 — Shape

Remodel:

- body
- hood
- cockpit
- fenders
- bumper integration
- antenna

Ignore texture details.

### PASS 2 — Materials

Create:

- green paint
- dark metal
- rubber
- glass
- chrome
- emissive

### PASS 3 — Identity

Add:

- bull emblem
- market graphic
- money display housing

### PASS 4 — Detail

Add:

- vents
- seams
- screws
- panel details

### PASS 5 — Three.js

Verify:

- GLB
- hierarchy
- pivots
- materials
- emissive controls
- animation sockets

---

# 40. DO NOT MODEL THE DRIVER YET

The current screenshot includes a rounded/brown central form that does not yet communicate a convincing driver/cockpit.

For now:

prioritize vehicle body.

The driver/mascot can be added later.

The car must look correct without a visible character.

---

# 41. IMPORTANT DESIGN RULE

The car must look good with:

> EMISSIVE OFF

First.

Then:

> EMISSIVE ON

If the model only looks good because everything is glowing green, the texture/material pass is not successful.

---

# 42. SECOND IMPORTANT RULE

The bumper must be clearly identifiable even in grayscale.

Test the model with:

- no color
- no emission
- neutral lighting

If the silhouette still reads:

> bumper car

the geometry is successful.

---

# 43. THIRD IMPORTANT RULE

Do not use texture to compensate for incorrect geometry.

If a surface needs to look curved:

model it curved.

If the bumper needs volume:

model volume.

If the wheel needs an arch:

model the arch.

Textures should provide:

> material + surface detail

not:

> fake geometry.

---

# 44. THREE.JS IMPLEMENTATION

The existing Three.js runtime should continue to control:

- money display
- emissive intensity
- antenna electricity
- headlights
- taillights
- boost glow

Do not bake dynamic effects into the texture.

The GLB should contain:

> base appearance

Three.js should provide:

> runtime state

---

# 45. FINAL ACCEPTANCE CRITERIA

The HOOD BULL model is approved only when:

### Shape

- clearly reads as bumper car
- has rounded compact body
- has visible cockpit
- has integrated bumper
- has readable four-wheel stance
- has believable antenna

### Material

- green paint looks premium
- rubber is clearly rubber
- metal is clearly metal
- glass is clearly glass
- emissive is controlled

### Identity

- bull motif is recognizable
- stock-market influence is subtle
- money display is prominent

### Gameplay readability

From gameplay camera:

- car silhouette remains readable
- bumper is visible
- wheels are readable
- antenna is readable
- money display is readable

### Technical

- clean UV
- correct pivots
- clean GLB
- modular materials
- Three.js-compatible
- reasonable performance

---

# 46. AGENT TASK

DO NOT create another vehicle.

DO NOT create the arena.

DO NOT create UI.

DO NOT create VFX production assets.

DO NOT create blockchain systems.

Focus ONLY on:

> REFINING THE EXISTING HOOD BULL MODEL TO MATCH THE PROVIDED REFERENCE.

Work in this order:

1. remodel silhouette
2. integrate bumper
3. improve cockpit
4. improve wheels/fenders
5. resize antenna/contact head
6. create material separation
7. create PBR texture set
8. add bull identity
9. integrate money display housing
10. test in Three.js gameplay camera

STOP after this asset reaches approval quality.
:::

### Dan arahan visual untuk agent

Jangan suruh agent **“make it prettier.”** Itu terlalu subjektif.

Kasih aturan:

> **“Do not redesign the concept. Correct the current mesh toward the provided HOOD BULL reference. Shape first, material second, detail third.”**

Dan yang paling penting dari screenshot kamu sekarang:

**jangan mulai texture dulu.**

Saya akan paksa urutannya:

**CURRENT MESH → SHAPE CORRECTION → SILHOUETTE APPROVAL → MATERIAL → TEXTURE → THREE.JS**

Karena kalau sekarang langsung diberi texture PBR, bentuk yang masih terlalu datar itu hanya akan menjadi **versi bertekstur dari shape yang salah**.

---

# 50. FULL FLEET 3D OVERHAUL & AUTOMOTIVE ARCHITECTURE (MILESTONE COMPLETED)

### Overview
Following the successful automotive geometry overhaul of `HOOD BULL`, the full 5-vehicle roster defined in `docs/car/prd.md` has been upgraded with production-grade 3D Blender GLB models, circular wheel arches, coke-bottle sculpted waistlines, integrated front fascias, custom mascot drivers, and 2048x2048 procedural PBR maps:

1. **HOOD BULL (All-Rounder)**: Metallic emerald green (`#00B84B`), dual white/gold racing stripes, gold bull mascot crest on hood/doors, bull driver with horns, `$85` digital screen, emerald neon halo (`#00ff88`). Model: `public/models/hood_bull.glb`.
2. **HOOD BEAR (Tank / Brawler)**: Deep crimson & charcoal, aggressive claw slash pinstripes, bear crest, bear driver with snout and round ears, `$120` digital screen, ruby red neon halo (`#ff1432`). Model: `public/models/hood_bear.glb`.
3. **TSLA RACER (Speedster / Hit-and-Run)**: Pearl white high-gloss, crimson racing stripes, tech 'T' crest, cyber robot driver with visor, `$200` digital screen, electric cyan neon halo (`#00d9ff`). Model: `public/models/tsla_racer.glb`.
4. **NVDA AI (Precision / Cornering)**: Obsidian black stealth, radioactive lime/purple circuit traces, AI eye crest, faceted cyber bot driver, `$150` digital screen, purple neon halo (`#c084fc`). Model: `public/models/nvda_ai.glb`.
5. **GOLD WHALE (Luxury GT / Chaos Gambler)**: Mirror 24K gold chrome, carbon fiber center deck, diamond crest, whale driver with VIP gold crown, `$500` digital screen, dual golden antenna masts, gold neon halo (`#ffd700`). Model: `public/models/gold_whale.glb`.

### Engine & Pipeline Integrations
- **AssetManager Universal GLB Loader**: Automatically discovers and loads `/models/${type}.glb` for all vehicle types with graceful fallback.
- **Node Contract Preservation**: All 5 vehicles expose uniform `CarNodeBindings` (`Body`, `Bumper`, `Wheel_FL..RR`, `Headlight_L/R`, `TailLight_L/R`, `Antenna`, `MoneyDisplay`, `Driver`).
- **Showroom Stage & Carousel**: Smooth 3D turntable transitions across all 5 cars with dynamic neon ring colors matching each vehicle's stock identity.
- **Leaderboard Podium**: Renders Gold Whale (#1), Hood Bear (#2), and Tsla Racer (#3) on pedestals with dynamically projected 3D-to-2D floating badges.
- **In-Arena Combat**: Full 5-car roster battles simultaneously in the Neon Market Arena with damage deformation, money scattering, and zero-sum liquidation.

