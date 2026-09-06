// Effets visuels plein écran : vignettage du terrain, météo, Distorsion, Vent Arrière.
// Tout est en CSS (voir index.css, section "FX"), ce calque ne capte pas la souris.
import type { FieldState } from '../model'

const TERRAIN_COLOR: Record<string, string> = {
  Electric: 'rgba(250, 204, 21, 0.45)',
  Grassy: 'rgba(74, 222, 128, 0.45)',
  Psychic: 'rgba(244, 114, 182, 0.45)',
  Misty: 'rgba(240, 171, 252, 0.40)',
}

export default function FxLayer({ field }: { field: FieldState }) {
  const windLeft = field.left.tailwind // vent qui part de la gauche vers la droite
  const windRight = field.right.tailwind
  return (
    <div className="fx-root" aria-hidden="true">
      {field.terrain && <div className="fx-vignette" style={{ boxShadow: `inset 0 0 220px 40px ${TERRAIN_COLOR[field.terrain]}` }} />}
      {field.weather === 'Rain' && <div className="fx-rain" />}
      {field.weather === 'Snow' && <div className="fx-snow" />}
      {field.weather === 'Sun' && <div className="fx-sun" />}
      {field.weather === 'Sand' && <div className="fx-sand" />}
      {field.trickRoom && <div className="fx-trickroom" />}
      {field.gravity && <div className="fx-gravity" />}
      {windLeft && <div className="fx-wind fx-wind-ltr" />}
      {windRight && <div className="fx-wind fx-wind-rtl" />}
    </div>
  )
}
