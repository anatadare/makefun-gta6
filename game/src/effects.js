// effects.js — particles, skid marks, muzzle flashes and screen shake.
// Purely visual: nothing here changes gameplay state, so the render pass
// can run it without worrying about the simulation.

import { clamp } from './random.js';

export function createEffects() {
  const particles = [];
  const skids = [];
  const flashes = [];
  let shake = 0;
  let flashOverlay = null;

  function spawn(x, y, opts) {
    particles.push({
      x, y,
      vx: opts.vx || 0,
      vy: opts.vy || 0,
      life: opts.life || 0.5,
      maxLife: opts.life || 0.5,
      size: opts.size || 3,
      color: opts.color || '#ffffff',
      drag: opts.drag || 2,
      gravity: opts.gravity || 0,
    });
    if (particles.length > 400) particles.splice(0, particles.length - 400);
  }

  return {
    get shake() {
      return shake;
    },
    addShake(amount) {
      shake = clamp(shake + amount, 0, 14);
    },
    setFlash(color, alpha, seconds) {
      flashOverlay = { color, alpha, seconds, t: 0 };
    },
    burst(x, y, color, count, speed) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.3 + Math.random() * 0.7);
        spawn(x, y, {
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 0.3 + Math.random() * 0.4,
          size: 2 + Math.random() * 3,
          color,
        });
      }
    },
    exhaust(x, y, angle) {
      spawn(x - Math.cos(angle) * 20, y - Math.sin(angle) * 20, {
        vx: -Math.cos(angle) * 30 + (Math.random() - 0.5) * 20,
        vy: -Math.sin(angle) * 30 + (Math.random() - 0.5) * 20,
        life: 0.4,
        size: 3 + Math.random() * 3,
        color: 'rgba(160,160,160,0.5)',
      });
    },
    dust(x, y) {
      spawn(x, y, {
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        life: 0.5,
        size: 4 + Math.random() * 4,
        color: 'rgba(200,190,160,0.45)',
      });
    },
    blood(x, y) {
      this.burst(x, y, '#a93226', 8, 120);
    },
    sparks(x, y) {
      this.burst(x, y, '#f5d76e', 10, 200);
    },
    muzzle(x, y, angle) {
      flashes.push({ x, y, angle, life: 0.07, maxLife: 0.07 });
    },
    skid(x, y, angle) {
      skids.push({ x, y, angle, life: 6 });
      if (skids.length > 220) skids.splice(0, skids.length - 220);
    },
    cashPop(x, y) {
      this.burst(x, y, '#2ecc71', 12, 140);
    },
    update(dt) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        const drag = Math.max(0, 1 - p.drag * dt);
        p.vx *= drag;
        p.vy *= drag;
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (let i = skids.length - 1; i >= 0; i--) {
        skids[i].life -= dt;
        if (skids[i].life <= 0) skids.splice(i, 1);
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        flashes[i].life -= dt;
        if (flashes[i].life <= 0) flashes.splice(i, 1);
      }
      if (flashOverlay) {
        flashOverlay.t += dt;
        if (flashOverlay.t >= flashOverlay.seconds) flashOverlay = null;
      }
      shake = Math.max(0, shake - dt * 26);
    },
    drawGround(ctx) {
      for (const s of skids) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        ctx.globalAlpha = Math.min(0.5, s.life / 6);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-7, -2.5, 14, 5);
        ctx.restore();
      }
    },
    drawAir(ctx) {
      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const f of flashes) {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.angle);
        ctx.globalAlpha = f.life / f.maxLife;
        ctx.fillStyle = '#ffe27a';
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(16, 0);
        ctx.lineTo(0, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
    drawOverlay(ctx, width, height) {
      if (!flashOverlay) return;
      const fade = 1 - flashOverlay.t / flashOverlay.seconds;
      ctx.globalAlpha = flashOverlay.alpha * fade;
      ctx.fillStyle = flashOverlay.color;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    },
  };
}
