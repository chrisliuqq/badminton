<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watchEffect } from 'vue'
import interact from 'interactjs'
import ControlPanel from './components/ControlPanel.vue'

// --- Types ---
interface Player {
  id: string
  label: string
  x: number
  y: number
  color: string
  defenseRadius: number
}

// --- Constants ---
const COURT_WIDTH = 610
const COURT_HEIGHT = 1340
const PLAYER_RADIUS = 15 // Visual radius (30px diameter)
const DEFENSE_RADIUS_NET = 120 // at Y=0 (1.2 steps)
const DEFENSE_RADIUS_BACK = 240 // at Y=1340 (2 steps)

// --- State ---
const players = ref<Player[]>([
  { id: 'A1', label: 'A1', x: 150, y: 1050, color: 'bg-blue-500', defenseRadius: 0 },
  { id: 'A2', label: 'A2', x: 460, y: 1050, color: 'bg-blue-500', defenseRadius: 0 },
  { id: 'B1', label: 'B1', x: 150, y: 200, color: 'bg-red-500', defenseRadius: 0 },
  { id: 'B2', label: 'B2', x: 460, y: 200, color: 'bg-red-500', defenseRadius: 0 }
])

const scaleFactor = ref(1)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const autoRotationEnabled = ref(false)

// Animation state
let animationFrameId: number | null = null

// --- Logic: Defense Range Calculation ---
const calculateDefenseRadius = (y: number) => {
  // Symmetric interpolation based on distance from NET (Y=670)
  // At Net (Y=670): Radius = DEFENSE_RADIUS_NET (120)
  // At Back Lines (Y=0 or Y=1340): Radius = DEFENSE_RADIUS_BACK (240)
  
  const NET_Y = 670
  const distFromNet = Math.abs(y - NET_Y)
  const maxDist = 670 // Distance from net to back line
  
  const t = distFromNet / maxDist
  return DEFENSE_RADIUS_NET + t * (DEFENSE_RADIUS_BACK - DEFENSE_RADIUS_NET)
}

// Update defense radius whenever Y changes
watchEffect(() => {
  players.value.forEach(player => {
    player.defenseRadius = calculateDefenseRadius(player.y)
  })
})

// --- Logic: Heatmap & Furthest Point ---
const updateHeatmap = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Clear canvas
  ctx.clearRect(0, 0, COURT_WIDTH, COURT_HEIGHT)

  // Only analyze lower half (A1, A2 territory)
  const startY = 670
  const endY = 1340
  const gridSize = 10 // 10px grid for better resolution (was 20)

  let maxDist = 0
  let maxPoint = { x: 0, y: 0 }

  // Get A-team players
  const teamA = players.value.filter(p => p.id.startsWith('A'))

  for (let y = startY; y <= endY; y += gridSize) {
    for (let x = 0; x <= COURT_WIDTH; x += gridSize) {
      // Calculate vulnerability ratio for each player and take the minimum (easiest defense)
      // This ensures smooth blending between players with different defense radii
      let minRatio = Infinity
      let minDist = Infinity // Still needed for Furthest Point (Absolute Distance)
      
      for (const p of teamA) {
        const dx = x - p.x
        const dy = y - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        
        // For Heatmap: Ratio (Distance / Radius)
        // Avoid divide by zero
        const radius = p.defenseRadius || 1 
        const ratio = dist / radius
        
        if (ratio < minRatio) minRatio = ratio
        
        // For Furthest Point: Absolute Distance
        if (dist < minDist) minDist = dist
      }

      // Update max distance point (Absolute distance logic remains for "Furthest Point")
      if (minDist > maxDist) {
        maxDist = minDist
        maxPoint = { x, y }
      }

      // Draw heatmap rect based on minRatio
      // Logic: 
      // - Ratio < 0.5 (within 50% of defense radius) -> Safe (Alpha 0)
      // - Ratio >= 0.5 -> Gradient starts
      if (minRatio > 0.5) {
        // Map 0.5 -> 2.5 to Alpha 0 -> 0.5
        let alpha = ((minRatio - 0.5) / 2.0) * 0.5
        alpha = Math.min(Math.max(alpha, 0), 0.5) // Clamp

        if (alpha > 0.05) {
          ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`
          ctx.fillRect(x - gridSize/2, y - gridSize/2, gridSize, gridSize)
        }
      }
    }
  }

  // Draw Furthest Point Marker
  if (maxDist > 0) {
    const r = 30 // Increased radius
    // Clamp coordinates to keep circle fully inside court
    // X: [r, Width - r]
    const drawX = Math.max(r, Math.min(maxPoint.x, COURT_WIDTH - r))
    
    // Y: [Net + r, Height - r]
    // Ensure it doesn't cross the net (Y=670) visually
    const minDrawY = 670 + r
    const maxDrawY = COURT_HEIGHT - r
    const drawY = Math.max(minDrawY, Math.min(maxPoint.y, maxDrawY))

    ctx.beginPath()
    ctx.arc(drawX, drawY, r, 0, Math.PI * 2)
    ctx.fillStyle = '#FF0000' // Bright Red, fully opaque
    ctx.fill()
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 3
    ctx.stroke()

    // Draw X
    ctx.beginPath()
    ctx.moveTo(drawX - 8, drawY - 8)
    ctx.lineTo(drawX + 8, drawY + 8)
    ctx.moveTo(drawX + 8, drawY - 8)
    ctx.lineTo(drawX - 8, drawY + 8)
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

// Trigger heatmap update when players move
watchEffect(() => {
  // Dependency on players.value positions
  // We need to access x/y to trigger reactivity
  players.value.map(p => p.x + p.y) 
  updateHeatmap()
})


// --- Logic: Auto-Rotation (Standard Badminton Tactics) ---
const calculateOptimalPosition = (movingPlayer: Player, _teammate: Player): { x: number, y: number } => {
  const centerX = COURT_WIDTH / 2 // 305
  const NET_Y = 670
  const BACK_LINE_Y = 1340
  const CENTER_Y = (NET_Y + BACK_LINE_Y) / 2 // 1005

  // State Thresholds
  const ATTACK_THRESHOLD = 1200 // Deep back court -> Attack
  const NET_THRESHOLD = 900     // Near net -> Net Play

  let targetX, targetY

  // --- State Determination ---
  if (movingPlayer.y > ATTACK_THRESHOLD) {
    // === STATE: ATTACK (Front-and-Back) ===
    // Scenario: Player is in deep back court (Smashing/Clearing).
    // Role: Teammate becomes Front Player (Net Interceptor).
    // Tactic: Straight Line Priority (Pressure).
    
    // Y: Move to Front T-Point area (approx 900-950)
    targetY = 920 

    // X: Same-Side Interception
    // If A1 is Right, A2 goes Right. If A1 is Left, A2 goes Left.
    // We use a small offset from center to bias towards the attacking side.
    const dx = movingPlayer.x - centerX
    const attackBias = 0.2 // Bias factor
    targetX = centerX + (dx * attackBias)

  } else if (movingPlayer.y < NET_THRESHOLD) {
    // === STATE: NET PLAY (Front-and-Back) ===
    // Scenario: Player is at the net (Lift/Net Shot).
    // Role: Teammate becomes Back Player (Rear Coverage).
    // Tactic: Cross-Court Coverage (Safety).

    // Y: Dynamic Rear Coverage
    // Problem with fixed 1250: If MP is at 850 (just slightly front), TM goes to 1250 (deep back), leaving mid-front open.
    // New Logic: The further MP goes forward, the further TM goes back.
    // Pivot around Center (1005).
    
    const yDistFromCenter = CENTER_Y - movingPlayer.y // Positive value
    const netPivotFactor = 0.25 // Reduced from 0.8 to 0.25 to keep TM closer to T-point (approx 1150) instead of deep back
    
    targetY = CENTER_Y + (yDistFromCenter * netPivotFactor)
    
    // Clamp to ensure they don't go off court but also don't stay too close to center
    targetY = Math.min(targetY, 1300) // Max back position

    // X: Opposite Side (Coverage)
    // If A1 is Right Net, A2 covers Left Rear.
    // We use a moderate mirror factor to cover the open space.
    const dx = movingPlayer.x - centerX
    const coverageFactor = 0.2 // Reduced from 0.4 to keep TM closer to center
    targetX = centerX - (dx * coverageFactor)

  } else {
    // === STATE: DEFENSE (Side-by-Side) ===
    // Scenario: Player is in Mid-Court (Defense/Transition).
    // Role: Teammate stays Parallel but Staggered.
    // Tactic: Linked Defense (Windshield Wiper) + Soft Pivot.

    // Y: Soft Pivot (Staggered Alignment)
    // Problem with previous logic: Strict parallel leaves front/back open if MP moves slightly back/forward.
    // New Logic: If MP moves back, TM moves slightly forward (and vice versa).
    // "See-Saw" effect around the center.
    
    const yDiff = movingPlayer.y - CENTER_Y
    // If yDiff > 0 (Back), we want target to be slightly forward (negative adjustment).
    // Stagger Factor 0.6: If MP moves back 100px, TM moves forward 60px relative to MP?
    // No, relative to Center?
    // Let's say: targetY = CENTER_Y - (yDiff * 0.5)
    // If MP=1105 (Back 100), TM = 1005 - 50 = 955.
    // This creates a nice diagonal.
    
    targetY = CENTER_Y - (yDiff * 0.5)

    // X: Inverse Offset Logic (Anti-Overlap)
    // Problem with previous logic: When A1 moves to center, A2 also moves to center -> Overlap.
    // New Logic: 
    // - If A1 is at Center (dx=0), A2 should be Wide (Base Width).
    // - If A1 is at Sideline (dx=Max), A2 should be Narrow (Cover Center).
    
    const dx = movingPlayer.x - centerX
    const baseDefenseWidth = 260 // Increased from 180 to widen the defense stance
    const compressionFactor = 0.8 // Increased from 0.6 to ensure faster convergence to center when partner is wide
    
    // Calculate how far A2 should be from center
    // The further A1 is from center, the closer A2 gets to center.
    let targetOffset = baseDefenseWidth - (Math.abs(dx) * compressionFactor)
    
    // Ensure A2 doesn't cross over to A1's side (keep min offset positive-ish)
    // But actually, we want A2 to stay on their side.
    targetOffset = Math.max(20, targetOffset) // Keep at least 20px from center
    
    // Apply direction: Opposite to A1
    // If A1 is Right (dx>0), A2 is Left (centerX - offset).
    // If A1 is Left (dx<0), A2 is Right (centerX + offset).
    targetX = centerX - (Math.sign(dx || 1) * targetOffset)
  }

  // --- Clamping & Safety ---
  // Smart Clamp: Ensure defense range doesn't extend too far outside the court.
  // Applied ONLY to the auto-rotating teammate (calculated position).
  // We calculate the defense radius at the target Y, and ensure the player is at least
  // a certain fraction of that radius away from the edge.
  
  const currentRadius = calculateDefenseRadius(targetY)
  const edgeMargin = Math.max(PLAYER_RADIUS, currentRadius * 0.5) // Increased from 0.3 to 0.5 to reduce wasted range
  
  targetX = Math.max(edgeMargin, Math.min(targetX, COURT_WIDTH - edgeMargin))
  targetY = Math.max(NET_Y + edgeMargin, Math.min(targetY, COURT_HEIGHT - edgeMargin))
  
  return { x: targetX, y: targetY }
}

const animatePlayerMove = (player: Player, targetX: number, targetY: number, duration: number = 300) => {
  const startX = player.x
  const startY = player.y
  const startTime = performance.now()
  
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    
    // Ease out quad for smooth deceleration
    const easeProgress = 1 - Math.pow(1 - progress, 2)
    
    player.x = startX + (targetX - startX) * easeProgress
    player.y = startY + (targetY - startY) * easeProgress
    
    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate)
    } else {
      animationFrameId = null
    }
  }
  
  // Cancel any existing animation
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
  
  animationFrameId = requestAnimationFrame(animate)
}

// --- Logic: Scaling ---
const updateScale = () => {
  const heightScale = window.innerHeight / COURT_HEIGHT
  scaleFactor.value = heightScale
}

// --- Logic: Interact.js ---
const initInteract = () => {
  interact('.player')
    .draggable({
      inertia: true,
      modifiers: [
        interact.modifiers.restrictRect({
          restriction: 'parent',
          endOnly: true
        })
      ],
      listeners: {
        move(event) {
          const targetId = event.target.id.split('-')[1]
          const player = players.value.find(p => p.id === targetId)
          
          if (player) {
            let newX = player.x + (event.dx / scaleFactor.value)
            let newY = player.y + (event.dy / scaleFactor.value)
            
            const r = PLAYER_RADIUS
            const NET_Y = 670
            
            // X-axis clamping (same for all)
            newX = Math.max(r, Math.min(newX, COURT_WIDTH - r))

            // Y-axis clamping (Team specific)
            let minY = r
            let maxY = COURT_HEIGHT - r

            if (player.id.startsWith('A')) {
              // Team A: Lower Half (Net to Bottom)
              minY = NET_Y + r
              maxY = COURT_HEIGHT - r
            } else {
              // Team B: Upper Half (Top to Net)
              minY = r
              maxY = NET_Y - r
            }

            newY = Math.max(minY, Math.min(newY, maxY))

            player.x = newX
            player.y = newY
          }
        },
        end(event) {
          const targetId = event.target.id.split('-')[1]
          const player = players.value.find(p => p.id === targetId)
          
          // Auto-rotation for Team A only (Triggered on Drag End)
          if (player && autoRotationEnabled.value && player.id.startsWith('A')) {
            const teammate = players.value.find(p => 
              p.id.startsWith('A') && p.id !== player.id
            )
            
            if (teammate) {
              const optimalPos = calculateOptimalPosition(player, teammate)
              animatePlayerMove(teammate, optimalPos.x, optimalPos.y, 400) // Slightly slower for "reaction" feel
            }
          }
        }
      }
    })
}

// --- Lifecycle ---
onMounted(() => {
  updateScale()
  window.addEventListener('resize', updateScale)
  initInteract()
  // Initial draw
  setTimeout(updateHeatmap, 100)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScale)
  interact('.player').unset()
})

// --- Styles ---
const playerStyles = computed(() => {
  const styles: Record<string, any> = {}
  players.value.forEach(p => {
    // With the -m-4 p-4 structure:
    // To center the 30px circle at (x, y), we need to offset by -15px
    styles[p.id] = {
      transform: `translate(${p.x - PLAYER_RADIUS}px, ${p.y - PLAYER_RADIUS}px)`
    }
  })
  return styles
})

const rangeStyles = computed(() => {
  const styles: Record<string, any> = {}
  players.value.forEach(p => {
    const r = p.defenseRadius
    styles[p.id] = {
      width: `${r * 2}px`,
      height: `${r * 2}px`,
      transform: `translate(${p.x - r}px, ${p.y - r}px)`
    }
  })
  return styles
})

const courtStyle = computed(() => ({
  width: `${COURT_WIDTH}px`,
  height: `${COURT_HEIGHT}px`,
  backgroundImage: `url(${import.meta.env.BASE_URL}court.svg)`,
  transform: `scale(${scaleFactor.value})`
}))
</script>

<template>
  <div class="w-full h-dvh bg-gray-900 flex justify-center items-center overflow-hidden relative touch-none">
    
    <!-- Court Container -->
    <div 
      class="relative bg-no-repeat bg-contain bg-center shadow-2xl origin-center will-change-transform flex-shrink-0"
      :style="courtStyle"
    >
      
      <!-- Heatmap Canvas (Layer 0.5: Above Court, Below Ranges) -->
      <canvas
        ref="canvasRef"
        :width="COURT_WIDTH"
        :height="COURT_HEIGHT"
        class="absolute top-0 left-0 pointer-events-none z-5"
      ></canvas>

      <!-- Defense Ranges (Layer 1: Below Players) -->
      <div
        v-for="player in players"
        :key="player.id + '-range'"
        class="absolute rounded-full border-2 border-dashed border-white/40 bg-white/10 pointer-events-none z-0 will-change-transform"
        :style="rangeStyles[player.id]"
      ></div>

      <!-- Players (Layer 2: Interactive) -->
      <div
        v-for="player in players"
        :key="player.id"
        :id="'player-' + player.id"
        class="player group absolute z-10 touch-none cursor-grab will-change-transform"
        :style="playerStyles[player.id]"
      >
        <!-- Hit Area Expansion -->
        <div class="-m-4 p-4">
          <!-- Visual Player Circle -->
          <div 
              class="w-[30px] h-[30px] rounded-full border-2 border-white flex justify-center items-center text-xs font-bold text-white shadow-md transition-transform group-active:scale-110"
              :class="player.color"
          >
              {{ player.label }}
          </div>
        </div>
      </div>

    </div>

    <!-- Control Panel -->
    <ControlPanel v-model:autoRotation="autoRotationEnabled" />
  </div>
</template>
