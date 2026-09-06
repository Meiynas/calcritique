// Effets visuels plein écran : terrain (vignettage + particules), météo, salles, Gravité, Vent Arrière.
// Les particules (pluie, neige, sable, feuilles, éclairs, rafales) sont dessinées sur un canvas ;
// les halos, brumes et grilles sont en CSS (voir index.css, section "FX").
import { useEffect, useRef } from 'react'
import type { FieldState } from '../model'

interface Particle {
  x: number; y: number; vx: number; vy: number; size: number; life: number; maxLife: number; rot: number; vr: number; hue: number
}

// Position (en % de l'écran), taille et couleur des hexagones d'artefact, alignés sur la diagonale du soleil (86 %, -6 %)
const FLARE_HEXES = [
  { x: 78, y: 8, size: 14, color: 'rgba(255, 255, 240, 0.55)' },
  { x: 70, y: 18, size: 40, color: 'rgba(253, 224, 71, 0.22)' },
  { x: 63, y: 27, size: 22, color: 'rgba(255, 200, 120, 0.30)' },
  { x: 55, y: 38, size: 70, color: 'rgba(251, 146, 60, 0.14)' },
  { x: 48, y: 47, size: 30, color: 'rgba(134, 239, 172, 0.22)' },
  { x: 40, y: 57, size: 110, color: 'rgba(255, 210, 120, 0.10)' },
  { x: 33, y: 66, size: 18, color: 'rgba(255, 255, 255, 0.35)' },
  { x: 24, y: 78, size: 56, color: 'rgba(147, 197, 253, 0.16)' },
  { x: 15, y: 90, size: 34, color: 'rgba(244, 114, 182, 0.16)' },
]

interface Bolt { pts: [number, number][]; life: number; maxLife: number }

export default function FxLayer({ field }: { field: FieldState }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const state = useRef(field)
  state.current = field

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    let raf = 0
    let W = 0, H = 0, dpr = 1
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const rain: Particle[] = [], snow: Particle[] = [], sand: Particle[] = [], leaves: Particle[] = [], wind: Particle[] = [], grav: Particle[] = []
    const bolts: Bolt[] = []
    let nextBolt = 0
    let last = performance.now()

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      W = window.innerWidth; H = window.innerHeight
      c!.width = W * dpr; c!.height = H * dpr
      c!.style.width = W + 'px'; c!.style.height = H + 'px'
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const rnd = (a: number, b: number) => a + Math.random() * (b - a)
    function fill(arr: Particle[], n: number, make: () => Particle) {
      while (arr.length < n) arr.push(make())
      if (arr.length > n) arr.length = n
    }

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const f = state.current
      ctx!.clearRect(0, 0, W, H)
      const scale = Math.max(0.5, Math.min(1.5, (W * H) / (1920 * 1080)))

      // ----- Pluie : gouttes allongées, légèrement inclinées, éclaboussure au sol -----
      if (f.weather === 'Rain') {
        fill(rain, Math.round(220 * scale), () => ({ x: rnd(-100, W), y: rnd(-H, 0), vx: rnd(60, 120), vy: rnd(900, 1400), size: rnd(10, 22), life: 0, maxLife: 1, rot: 0, vr: 0, hue: 0 }))
        ctx!.lineCap = 'round'
        for (const p of rain) {
          p.x += p.vx * dt; p.y += p.vy * dt
          if (p.y > H) { p.y = rnd(-80, -10); p.x = rnd(-100, W) }
          const a = 0.18 + (p.size - 10) / 40
          ctx!.strokeStyle = `rgba(170, 205, 255, ${a})`
          ctx!.lineWidth = 1 + (p.size - 10) / 12
          ctx!.beginPath(); ctx!.moveTo(p.x, p.y); ctx!.lineTo(p.x - p.vx * 0.012, p.y - p.size); ctx!.stroke()
        }
      } else rain.length = 0

      // ----- Neige : flocons doux qui ondulent -----
      if (f.weather === 'Snow') {
        fill(snow, Math.round(140 * scale), () => ({ x: rnd(0, W), y: rnd(-H, 0), vx: rnd(-15, 15), vy: rnd(35, 90), size: rnd(1.5, 4), life: rnd(0, 6.28), maxLife: 1, rot: 0, vr: 0, hue: 0 }))
        for (const p of snow) {
          p.life += dt
          p.x += (p.vx + Math.sin(p.life * 1.5) * 20) * dt; p.y += p.vy * dt
          if (p.y > H + 5) { p.y = -5; p.x = rnd(0, W) }
          ctx!.fillStyle = `rgba(255,255,255,${0.5 + p.size / 8})`
          ctx!.beginPath(); ctx!.arc(p.x, p.y, p.size, 0, 6.283); ctx!.fill()
        }
      } else snow.length = 0

      // ----- Tempête de sable : grains vifs qui filent, avec turbulence -----
      if (f.weather === 'Sand') {
        fill(sand, Math.round(320 * scale), () => ({ x: rnd(0, W), y: rnd(0, H), vx: rnd(500, 1100), vy: rnd(-40, 40), size: rnd(1, 2.6), life: rnd(0, 6.28), maxLife: 1, rot: 0, vr: 0, hue: rnd(30, 45) }))
        for (const p of sand) {
          p.life += dt * 6
          p.x += p.vx * dt; p.y += (p.vy + Math.sin(p.life) * 60) * dt
          if (p.x > W + 10) { p.x = -10; p.y = rnd(0, H) }
          if (p.y < -10) p.y = H + 5; else if (p.y > H + 10) p.y = -5
          ctx!.fillStyle = `hsla(${p.hue}, 70%, ${60 + p.size * 8}%, ${0.35 + p.size / 5})`
          ctx!.beginPath(); ctx!.ellipse(p.x, p.y, p.size * 3, p.size, 0.05, 0, 6.283); ctx!.fill()
        }
      } else sand.length = 0

      // ----- Champ Herbu : feuilles qui tourbillonnent -----
      if (f.terrain === 'Grassy') {
        fill(leaves, Math.round(45 * scale), () => ({ x: rnd(0, W), y: rnd(0, H), vx: rnd(-25, 25), vy: rnd(-40, -10), size: rnd(5, 11), life: rnd(0, 6.28), maxLife: 1, rot: rnd(0, 6.28), vr: rnd(-2, 2), hue: rnd(95, 140) }))
        for (const p of leaves) {
          p.life += dt
          p.x += (p.vx + Math.sin(p.life * 0.8) * 30) * dt; p.y += p.vy * dt; p.rot += p.vr * dt
          if (p.y < -20) { p.y = H + 20; p.x = rnd(0, W) }
          if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20
          ctx!.save(); ctx!.translate(p.x, p.y); ctx!.rotate(p.rot)
          ctx!.fillStyle = `hsla(${p.hue}, 60%, 45%, 0.75)`
          ctx!.beginPath(); ctx!.moveTo(0, -p.size); ctx!.quadraticCurveTo(p.size * 0.9, 0, 0, p.size); ctx!.quadraticCurveTo(-p.size * 0.9, 0, 0, -p.size); ctx!.fill()
          ctx!.strokeStyle = `hsla(${p.hue}, 50%, 30%, 0.6)`; ctx!.lineWidth = 0.8
          ctx!.beginPath(); ctx!.moveTo(0, -p.size * 0.8); ctx!.lineTo(0, p.size * 0.8); ctx!.stroke()
          ctx!.restore()
        }
      } else leaves.length = 0

      // ----- Champ Électrique : petits éclairs qui crépitent -----
      if (f.terrain === 'Electric') {
        if (now > nextBolt) {
          nextBolt = now + rnd(120, 450)
          const x = rnd(0, W), y = rnd(0, H)
          const pts: [number, number][] = [[x, y]]
          let cx = x, cy = y
          const n = Math.round(rnd(4, 9)), len = rnd(6, 18)
          const dir = rnd(0, 6.28)
          for (let i = 0; i < n; i++) { cx += Math.cos(dir + rnd(-1, 1)) * len; cy += Math.sin(dir + rnd(-1, 1)) * len; pts.push([cx, cy]) }
          bolts.push({ pts, life: 0, maxLife: rnd(0.12, 0.25) })
        }
        for (let i = bolts.length - 1; i >= 0; i--) {
          const b = bolts[i]; b.life += dt
          if (b.life > b.maxLife) { bolts.splice(i, 1); continue }
          const a = 1 - b.life / b.maxLife
          ctx!.lineCap = 'round'; ctx!.lineJoin = 'round'
          ctx!.shadowColor = 'rgba(250, 220, 80, 0.9)'; ctx!.shadowBlur = 12
          ctx!.strokeStyle = `rgba(255, 245, 170, ${0.9 * a})`; ctx!.lineWidth = 2
          ctx!.beginPath(); b.pts.forEach(([px, py], j) => (j ? ctx!.lineTo(px, py) : ctx!.moveTo(px, py))); ctx!.stroke()
          ctx!.shadowBlur = 0
        }
      } else bolts.length = 0

      // ----- Gravité : poussières qui chutent lourdement -----
      if (f.gravity) {
        fill(grav, Math.round(60 * scale), () => ({ x: rnd(0, W), y: rnd(0, H), vx: 0, vy: rnd(250, 500), size: rnd(1, 2.5), life: 0, maxLife: 1, rot: 0, vr: 0, hue: 0 }))
        for (const p of grav) {
          p.y += p.vy * dt
          if (p.y > H) { p.y = -5; p.x = rnd(0, W) }
          ctx!.fillStyle = 'rgba(200, 200, 220, 0.35)'
          ctx!.fillRect(p.x, p.y, p.size, p.size * 4)
        }
      } else grav.length = 0

      // ----- Vent Arrière : rafales horizontales dans le sens de l'équipe qui l'a -----
      const dirs: number[] = []
      if (f.left.tailwind) dirs.push(1)
      if (f.right.tailwind) dirs.push(-1)
      if (dirs.length) {
        fill(wind, Math.round(70 * scale * dirs.length), () => {
          const d = dirs[Math.floor(Math.random() * dirs.length)]
          return { x: rnd(0, W), y: rnd(0, H), vx: d * rnd(900, 1500), vy: rnd(-10, 10), size: rnd(60, 220), life: 0, maxLife: 1, rot: d, vr: 0, hue: 0 }
        })
        ctx!.lineCap = 'round'
        for (const p of wind) {
          if (!dirs.includes(p.rot)) { p.rot = dirs[0]; p.vx = p.rot * Math.abs(p.vx) }
          p.x += p.vx * dt; p.y += p.vy * dt
          if (p.rot > 0 && p.x - p.size > W) { p.x = -p.size; p.y = rnd(0, H) }
          if (p.rot < 0 && p.x + p.size < 0) { p.x = W + p.size; p.y = rnd(0, H) }
          const g = ctx!.createLinearGradient(p.x - p.size * p.rot, p.y, p.x, p.y)
          g.addColorStop(0, 'rgba(165, 243, 252, 0)'); g.addColorStop(1, 'rgba(165, 243, 252, 0.55)')
          ctx!.strokeStyle = g; ctx!.lineWidth = 1.5
          ctx!.beginPath(); ctx!.moveTo(p.x - p.size * p.rot, p.y); ctx!.lineTo(p.x, p.y); ctx!.stroke()
        }
      } else wind.length = 0

      if (!reduced) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <div className="fx-root" aria-hidden="true">
      {field.terrain && <div className={'fx-terrain fx-terrain-' + field.terrain.toLowerCase()} />}
      {field.terrain === 'Misty' && <div className="fx-mist" />}
      {field.weather === 'Sun' && <div className="fx-sun" />}
      {field.weather === 'Sun' && (
        <div className="fx-flare">
          {FLARE_HEXES.map((h, i) => (
            <div key={i} className="fx-hex" style={{ left: `${h.x}%`, top: `${h.y}%`, width: h.size, height: h.size, background: h.color }} />
          ))}
        </div>
      )}
      {field.weather === 'Rain' && <div className="fx-raintint" />}
      {field.weather === 'Sand' && <div className="fx-sandtint" />}
      {field.weather === 'Snow' && <div className="fx-snowtint" />}
      {field.trickRoom && <div className="fx-trickroom" />}
      {field.gravity && <div className="fx-gravity" />}
      {field.magicRoom && <div className="fx-magicroom" />}
      {field.magicRoom && <div className="fx-magicroom-tint" />}
      {field.wonderRoom && <div className="fx-wonderroom" />}
      <canvas ref={canvas} className="fx-canvas" />
    </div>
  )
}
