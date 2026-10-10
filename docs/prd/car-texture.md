You are the lead 3D gameplay engineer for BUMP.TRADE.

You have already been given:

1. The complete BUMP.TRADE product/context specification.
2. The BUMP.TRADE 3D asset reference images.
3. The vehicle lineup reference.
4. The hero car reference.
5. The visual direction and gameplay concept.

Do NOT ask me to repeat the design context.

Your job now is to turn the provided visual references and specification into a clean, production-ready Three.js gameplay foundation.

==================================================
PRIMARY GOAL
==================================================

Do NOT build the entire game yet.

Do NOT build all vehicles.

Do NOT build the final arena.

Do NOT build blockchain, wallet, backend, tokenomics, matchmaking, or advanced UI.

We will build the project incrementally.

FIRST TARGET:

> ONE FULLY INTEGRATED HERO BUMPER CAR IN THREE.JS

The first milestone is:

HERO CAR
+
PHYSICS
+
MOVEMENT
+
BOOST
+
PROCEDURAL ANIMATION HOOKS
+
COLLISION RESPONSE HOOKS

The result should already be playable inside a simple test environment.

==================================================
STEP 0 — INSPECT BEFORE CODING
==================================================

Before writing implementation code:

1. Inspect the existing repository.
2. Identify the current framework/build system.
3. Identify existing Three.js setup.
4. Identify existing asset pipeline.
5. Identify existing physics library, if any.
6. Identify whether TypeScript is already configured.
7. Identify existing scene/camera/render loop.
8. Identify existing asset-loading utilities.
9. Identify existing conventions for files/classes/modules.

Do NOT rewrite the project unnecessarily.

Use existing architecture when reasonable.

If Three.js is already configured, build on top of it.

If a physics engine is already present, use it.

If no physics engine exists, use Rapier 3D.

==================================================
STEP 1 — CREATE THE HERO CAR SYSTEM
==================================================

Create the first playable vehicle:

> HOOD BULL

Treat the provided hero-car images as the visual source of truth.

The implementation should support a GLB asset.

Expected conceptual hierarchy:

CarRoot
├── Chassis
├── Body
├── Bumper
├── Wheel_FL
├── Wheel_FR
├── Wheel_RL
├── Wheel_RR
├── Antenna
├── ContactHead
├── MoneyDisplay
├── Headlight_L
├── Headlight_R
├── TailLight_L
├── TailLight_R
├── VFX_Impact
├── VFX_Boost
├── VFX_Antenna
├── VFX_Coin
└── VFX_Skid

Do not assume every node is already present in the current GLB.

Create a robust asset-binding layer so missing optional nodes do not crash the game.

Example conceptual behavior:

if Wheel_FL exists:
    animate it

if Antenna exists:
    animate it

if VFX_Boost exists:
    activate it

The system should degrade gracefully.

==================================================
STEP 2 — ASSET LOADING
==================================================

Create a clean asset loading system.

Use GLTFLoader.

The hero vehicle should be loaded through an AssetManager or equivalent centralized loader.

Do NOT load the GLB directly from arbitrary gameplay classes.

Expected conceptual flow:

AssetManager
    ↓
load hero GLB
    ↓
clone / instantiate
    ↓
HeroCar entity
    ↓
CarController

Cache important node references when the asset is loaded.

Do not repeatedly search the scene hierarchy every frame.

==================================================
STEP 3 — SCALE + ORIENTATION
==================================================

Use consistent world-space conventions.

World:

Y = up

Choose ONE vehicle-forward convention and use it consistently.

Recommended:

+Z = vehicle forward

Approximate real-world vehicle size:

length ≈ 2.6m

width ≈ 1.9m

height ≈ 1.35m

These values are starting references, not hard constraints.

The hero car must look correctly proportioned from an angled top-down gameplay camera.

==================================================
STEP 4 — PHYSICS PROXY
==================================================

Do NOT use the detailed visual mesh as the physics collider.

Create a simplified physics representation.

Suggested conceptual physics:

main chassis:
capsule or simplified rigid body

bumper:
simplified radial / convex collision area

No realistic wheel suspension simulation.

This is an arcade bumper-car game.

The desired result is:

heavy
responsive
slightly slippery
fun to ram

not:

realistic racing simulator

Keep physics parameters configurable.

Create a dedicated configuration object.

For example:

CarPhysicsConfig

including:

mass
acceleration
maxSpeed
reverseSpeed
steering
friction
lateralGrip
bounce
boostMultiplier
impactMultiplier

Do not scatter magic numbers across the codebase.

==================================================
STEP 5 — CAR CONTROLLER
==================================================

Create a clean vehicle controller.

Suggested separation:

CarController
CarPhysics
CarVisual
CarAnimation
CarVFX
CarAudio

Do NOT create one giant vehicle class containing everything.

CarController should coordinate the systems.

Conceptual flow:

input
↓
CarController
↓
CarPhysics
↓
velocity / rotation
↓
CarVisual
↓
CarAnimation
↓
CarVFX / Audio

==================================================
STEP 6 — PLAYER INPUT
==================================================

For the first milestone:

W = accelerate

S = reverse / brake

A = turn left

D = turn right

SPACE = boost

Input should be abstracted.

Do not hardcode keyboard checks inside physics code.

Create:

InputManager

or equivalent.

This allows controllers to later work with:

keyboard
gamepad
mobile controls
AI
network input

==================================================
STEP 7 — DRIVING MODEL
==================================================

The car is an arcade vehicle.

Required behavior:

- accelerate
- reverse
- steering
- braking
- friction
- lateral slide
- controlled drift
- wall/collision bounce later

Do NOT create realistic tire simulation.

The important sensation is:

> easy to drive, easy to understand, satisfying to ram

The vehicle should feel slightly heavy.

It should not feel like a frictionless spaceship.

==================================================
STEP 8 — PROCEDURAL VEHICLE ANIMATION
==================================================

Do not depend entirely on baked animation clips.

Use procedural animation driven by gameplay state.

Required states:

IDLE
MOVING
BRAKING
TURNING
DRIFTING
BOOSTING
HIT_LIGHT
HIT_HEAVY
HIT_CRITICAL
FALLING
LIQUIDATED
WIN
LOSS

First milestone only needs:

IDLE
MOVING
TURNING
DRIFTING
BOOSTING
HIT_LIGHT
HIT_HEAVY
HIT_CRITICAL

The architecture must support the remaining states later.

==================================================
STEP 9 — IDLE ANIMATION
==================================================

Stationary vehicle:

- subtle suspension movement
- slight body breathing
- small antenna movement
- subtle electrical activity

Keep amplitude low.

Goal:

The car should feel powered on.

==================================================
STEP 10 — DRIVING ANIMATION
==================================================

Procedural:

wheel rotation based on velocity

body pitch based on acceleration

body roll based on steering

Example conceptual behavior:

accelerate:
    body tilts slightly backward

brake:
    body tilts slightly forward

turn:
    body rolls slightly

Do not exaggerate.

==================================================
STEP 11 — DRIFT DETECTION
==================================================

Determine drift from actual vehicle motion.

Calculate:

forwardVelocity
lateralVelocity

Concept:

forwardVelocity = dot(velocity, forward)

lateralVelocity = dot(velocity, right)

If:

abs(lateralVelocity) > driftThreshold

then:

DRIFTING

During drift:

- subtle body rotation
- wheel steering visual
- tire smoke hook
- skid VFX hook

Do not fake drift purely from steering input.

==================================================
STEP 12 — BOOST
==================================================

SPACE activates boost.

Boost should modify physics:

higher acceleration
higher max speed
higher impact potential

Create:

BoostController

or equivalent.

The boost state must be readable by:

physics
animation
VFX
camera

Conceptual flow:

SPACE
↓
boost active
↓
physics multiplier
↓
wheel / body response
↓
antenna electricity
↓
boost trail
↓
camera FOV response

==================================================
STEP 13 — BOOST VISUALS
==================================================

For now, use placeholder VFX if final VFX does not exist.

The system must expose:

playBoost()
stopBoost()

The hero car should respond visually even before final VFX assets are supplied.

Possible temporary effects:

- emissive intensity increase
- small particle trail
- electric arc placeholder

Do NOT block gameplay implementation because final VFX are not ready.

==================================================
STEP 14 — ANTENNA ANIMATION
==================================================

The bumper-car antenna is a key identity element.

Procedural behavior:

IDLE:
    subtle sway

MOVING:
    slight motion response

BOOSTING:
    stronger vibration

IMPACT:
    brief recoil

The antenna should also expose an electric-intensity parameter:

antennaEnergy = 0 → 1

This will later control actual electricity VFX.

==================================================
STEP 15 — BUMPER RESPONSE
==================================================

The bumper must visually compress when the car receives an impact.

Create an impact spring system.

Normal:

bumper offset = 0

On impact:

bumper compresses

then:

returns to zero

Use spring/damped interpolation.

Do not permanently deform the model.

==================================================
STEP 16 — COLLISION EVENT API
==================================================

Do not tightly couple physics collision detection to visual effects.

Create a normalized collision event.

Example conceptual structure:

CollisionEvent

{
    attackerId,
    victimId,
    position,
    normal,
    relativeVelocity,
    impactForce,
    intensity,
    tier
}

Tier:

LIGHT
HEAVY
CRITICAL

Then other systems react to the event.

Example:

Physics
→ CollisionEvent

Animation
→ bumper response

VFX
→ sparks

Camera
→ shake

Audio
→ impact sound

Gameplay
→ knockback / money later

This architecture is extremely important.

==================================================
STEP 17 — IMPACT CALCULATION
==================================================

Calculate impact from relative motion.

Conceptually:

relativeVelocity =
attackerVelocity - victimVelocity

impactSpeed =
length(relativeVelocity)

impactForce =
impactSpeed × collisionMultiplier

Normalize:

intensity =
clamp(
    impactForce / maxImpactForce,
    0,
    1
)

Then classify:

LIGHT
HEAVY
CRITICAL

Thresholds must be configurable.

==================================================
STEP 18 — KNOCKBACK HOOK
==================================================

For the first milestone:

collision must produce a physical response.

At minimum:

victim receives impulse in collision direction

attacker may also receive a smaller reaction depending on impact conditions.

Do NOT make the target simply teleport backward.

Use physics impulse.

The desired visual:

> CRASH → VEHICLE RECOILS → VEHICLE FLIES BACK

==================================================
STEP 19 — IMPACT JUICE HOOKS
==================================================

Even if final VFX are not ready, expose these hooks:

playImpactSpark(position, intensity)

playImpactFlash(position, intensity)

playTireSkid(position, intensity)

playImpactSound(position, intensity)

cameraShake(intensity)

hitStop(intensity)

The first implementation can use placeholder effects.

Do not hard-code these effects directly inside the physics callback.

==================================================
STEP 20 — TEST ARENA
==================================================

Do NOT build the final NEON MARKET ARENA yet.

Create only a simple technical test arena.

Requirements:

- flat floor
- simple boundary
- enough space for vehicle testing
- neutral lighting
- simple camera

Purpose:

test:

movement
steering
boost
collision
knockback
animation

The test arena should be disposable / replaceable.

==================================================
STEP 21 — CAMERA
==================================================

Use an angled top-down gameplay camera.

Camera follows the hero car.

Requirements:

- smooth follow
- readable gameplay
- enough surrounding visibility

Create camera hooks for:

cameraShake(intensity)

and:

setBoostFOV(active)

Normal camera should remain stable.

==================================================
STEP 22 — UPDATE LOOP
==================================================

Maintain separation between:

physics timestep

and:

render frame

Use a fixed physics timestep.

Visual rendering can interpolate.

Conceptually:

while accumulator >= fixedStep:

    physics.step(fixedStep)

then:

render interpolation

Do not build physics directly around variable render delta.

==================================================
STEP 23 — FILE STRUCTURE

Use a clean structure such as:

src/

    core/
        AssetManager.ts
        GameLoop.ts
        Config.ts

    input/
        InputManager.ts

    physics/
        PhysicsWorld.ts
        CarPhysics.ts

    vehicles/
        CarController.ts
        CarVisual.ts
        CarAnimation.ts
        CarVFX.ts
        HeroCar.ts

    collision/
        CollisionSystem.ts
        CollisionEvent.ts

    camera/
        GameCamera.ts

    test/
        TestArena.ts

Adapt this to the existing repository rather than blindly creating the exact structure.

==================================================
STEP 24 — CONFIGURATION
==================================================

Create centralized tuning.

Example:

CAR_CONFIG

{
    mass,
    acceleration,
    maxSpeed,
    reverseSpeed,
    steeringRate,
    friction,
    lateralGrip,
    boostMultiplier,
    boostDuration,
    boostRecharge,
    impactMultiplier,
    heavyImpactThreshold,
    criticalImpactThreshold
}

All tuning should be easy to modify.

==================================================
STEP 25 — DEBUG MODE
==================================================

Create development-only debugging support.

Display:

FPS
position
velocity
speed
boost
state
impact intensity

Optionally render:

physics collider
forward vector
velocity vector

Debug mode should be toggleable.

==================================================
STEP 26 — WHAT TO DO WITH THE PROVIDED IMAGES
==================================================

The supplied reference images are visual guidance, NOT literal pixel-perfect geometry.

Use them to determine:

- silhouette
- proportions
- bumper shape
- antenna
- wheel placement
- visual personality
- material direction
- neon treatment
- overall proportions

Do not copy existing copyrighted vehicle designs.

The hero car should be an original fictional bumper-car design.

==================================================
STEP 27 — WHAT NOT TO DO
==================================================

Do NOT:

- build every car
- build the final arena
- build UI
- build wallet
- build blockchain
- build token
- build multiplayer
- build marketplace
- build matchmaking
- build live stock integration
- create a huge asset library
- add unnecessary dependencies
- rewrite the entire repository
- create complex vehicle simulation

Do NOT continue to the next production milestone automatically.

==================================================
FIRST DELIVERABLE
==================================================

Your FIRST implementation milestone must result in:

A playable Three.js scene where:

1. HOOD BULL exists as a vehicle.
2. The vehicle can move.
3. The vehicle can steer.
4. SPACE activates boost.
5. Vehicle animation reacts to movement.
6. Antenna reacts to movement/boost.
7. Bumper reacts to impact.
8. Two vehicle bodies can collide.
9. Collision generates a CollisionEvent.
10. Collision produces knockback.
11. Impact intensity is calculated.
12. LIGHT / HEAVY / CRITICAL impact tiers exist.
13. Camera follows the player.
14. Camera shake hook exists.
15. Test arena exists.
16. Physics debug mode exists.

Use placeholders where final art/VFX is unavailable.

==================================================
STOP CONDITION
==================================================

After completing this milestone:

STOP.

Do NOT move to:

Arena production
Additional cars
Money system
Multiplayer
Blockchain

until the hero-car gameplay foundation is structurally complete.

At the end, report:

1. files created
2. files modified
3. architecture implemented
4. physics approach
5. animation system
6. collision event system
7. remaining placeholder assets
8. how to run the test scene
9. known issues
10. exact next recommended milestone

The purpose of this milestone is to establish the foundation correctly, not to maximize feature count.

QUALITY BAR:

The result should feel like the beginning of a real 3D arcade game, not a technical demo full of disconnected scripts.
