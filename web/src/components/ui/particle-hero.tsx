import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A full-screen hero with a 3D particle sculpture drawn on a <canvas>.
 * The sculpture morphs between a few forms, follows the pointer, and pulses on click.
 * Everything runs in the page. No network, no library.
 */
export interface ParticleHeroProps {
  /** Content drawn over the sculpture: headline, buttons, small text. */
  children?: ReactNode;
  className?: string;
  /** Particle colour (any CSS colour the canvas accepts as rgb()). Default: Contest Here orange. */
  rgb?: [number, number, number];
  ariaLabel?: string;
}

// Radius of the surface in direction (x, y, z) on the unit sphere, for each form.
// t is time in seconds. Each returns about 1.
type Form = (x: number, y: number, z: number, th: number, ph: number, t: number) => number;
const FORMS: Form[] = [
  // bloom: six soft petals around the equator
  (_x, _y, _z, th, ph, t) => 1 + 0.22 * Math.sin(6 * ph + t * 0.6) * Math.sin(th) ** 2 + 0.1 * Math.cos(3 * th),
  // shell: ribbed sphere
  (_x, _y, _z, th, _ph, t) => 1 + 0.12 * Math.sin(10 * th - t * 0.8),
  // cube: rounded box
  (x, y, z) => 0.9 / Math.pow(x ** 4 + y ** 4 + z ** 4, 0.25),
  // knot: twisted lobes
  (_x, _y, _z, th, ph, t) => 1 + 0.2 * Math.sin(3 * ph + 4 * th + t * 0.5),
  // pillar: tall capsule
  (x, y, z) => 0.95 / Math.sqrt((x * x + z * z) * 1.9 + y * y * 0.42),
];
const HOLD = 4.5; // seconds a form stays
const MORPH = 1.6; // seconds a morph takes

const smooth = (a: number) => a * a * (3 - 2 * a);

export function ParticleHero({ children, className, rgb = [224, 138, 54], ariaLabel = "Animated hero" }: ParticleHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // A string key, so a new array with the same colour does not restart the animation.
  const rgbKey = rgb.join(",");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const count = window.innerWidth < 700 ? 5000 : 10000;

    // Points spread evenly on a unit sphere (Fibonacci lattice).
    const ux = new Float32Array(count), uy = new Float32Array(count), uz = new Float32Array(count);
    const th = new Float32Array(count), ph = new Float32Array(count);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (2 * (i + 0.5)) / count;
      const r = Math.sqrt(1 - y * y);
      const a = i * golden;
      ux[i] = Math.cos(a) * r;
      uy[i] = y;
      uz[i] = Math.sin(a) * r;
      th[i] = Math.acos(y);
      ph[i] = a % (Math.PI * 2);
    }

    // 10 depth shades, from far (pale) to near (full colour).
    const SHADES = 10;
    const [cr, cg, cb] = rgbKey.split(",").map(Number);
    const fills = Array.from({ length: SHADES }, (_, k) => {
      const f = 0.35 + (0.65 * k) / (SHADES - 1);
      const mix = (c: number) => Math.round(255 - (255 - c) * f);
      return `rgb(${mix(cr)},${mix(cg)},${mix(cb)})`;
    });
    const buckets: number[][] = Array.from({ length: SHADES }, () => []);
    const px = new Float32Array(count), py = new Float32Array(count), ps = new Float32Array(count);

    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Pointer tilts the sculpture; a press sends a pulse through it.
    let tx = 0, ty = 0, rx = 0, ry = 0, pulse = 0;
    const onMove = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect();
      tx = ((e.clientX - b.left) / b.width - 0.5) * 2;
      ty = ((e.clientY - b.top) / b.height - 0.5) * 2;
    };
    const onDown = () => { pulse = 1; };
    window.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);

    let visible = true;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(canvas);

    const start = performance.now();
    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible && !reduced) return;
      // The rAF time is the frame start, which can be a little before `start`, so clamp at 0.
      const t = reduced ? 0 : Math.max(0, (now - start) / 1000);

      const cycle = HOLD + MORPH;
      const k = Math.floor(t / cycle);
      const local = t - k * cycle;
      const a = FORMS[k % FORMS.length];
      const b = FORMS[(k + 1) % FORMS.length];
      const m = local < HOLD ? 0 : smooth((local - HOLD) / MORPH);

      rx += (ty * 0.35 - rx) * 0.05;
      ry += (tx * 0.6 - ry) * 0.05;
      pulse *= 0.95;
      const spin = t * 0.25 + ry;
      const cy = Math.cos(spin), sy = Math.sin(spin);
      const cx = Math.cos(0.25 + rx), sx = Math.sin(0.25 + rx);

      // Sculpture sits right of centre on wide screens, so the headline has room on the left.
      const wide = w > 900;
      const ox = wide ? w * 0.58 : w * 0.5;
      const oy = wide ? h * 0.48 : h * 0.4;
      const scale = Math.min(w, h) * (wide ? 0.3 : 0.27);
      const cam = 3.2;

      for (const list of buckets) list.length = 0;
      for (let i = 0; i < count; i++) {
        const x = ux[i], y = uy[i], z = uz[i];
        let r = a(x, y, z, th[i], ph[i], t);
        if (m > 0) r += (b(x, y, z, th[i], ph[i], t) - r) * m;
        r *= 1 + pulse * 0.18 * Math.sin(th[i] * 8 - t * 10);
        // rotate around Y, then around X
        const x1 = x * r * cy + z * r * sy;
        const z1 = -x * r * sy + z * r * cy;
        const y1 = y * r * cx - z1 * sx;
        const z2 = y * r * sx + z1 * cx;
        const p = cam / (cam - z2);
        px[i] = ox + x1 * scale * p;
        py[i] = oy - y1 * scale * p;
        ps[i] = p;
        const shade = Math.max(0, Math.min(SHADES - 1, Math.floor(((z2 + 1.3) / 2.6) * SHADES)));
        buckets[shade].push(i);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (let s = 0; s < SHADES; s++) {
        ctx.fillStyle = fills[s];
        const list = buckets[s];
        for (let j = 0; j < list.length; j++) {
          const i = list[j];
          const size = 1.1 + ps[i] * 1.1;
          ctx.fillRect(px[i] - size / 2, py[i] - size / 2, size, size);
        }
      }
      if (reduced) cancelAnimationFrame(raf);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
    };
  }, [rgbKey]);

  return (
    <section aria-label={ariaLabel} className={cn("relative h-svh min-h-[640px] w-full overflow-hidden", className)}>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full touch-pan-y" />
      <div className="pointer-events-none relative z-10 size-full">{children}</div>
    </section>
  );
}

export default ParticleHero;
