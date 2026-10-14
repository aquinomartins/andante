import { clamp, WalkerControl } from './control';
type Foot = { x: number; y: number; anchor: number; end: number; swing: boolean };
export class Scene {
  private ctx: CanvasRenderingContext2D;
  private background = document.createElement('canvas');
  private width = 1000;
  private height = 620;
  private ground = 470;
  private phase = 0;
  private lastDirection = 1;
  private feet: Foot[] = [0, 1].map(() => ({ x: 500, y: 0, anchor: 500, end: 500, swing: false }));
  private stars = Array.from({ length: 46 }, (_, i) => ({ x: ((i * 137.508) % 997) / 1000, y: ((i * 79.23) % 389) / 450, r: i % 7 === 0 ? 1.4 : 0.7, phase: i * 1.73 }));
  private observer: ResizeObserver;
  constructor(private canvas: HTMLCanvasElement, private control: WalkerControl) {
    this.ctx = canvas.getContext('2d')!;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.reset();
  }
  private resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 1.5, 1600 / Math.max(width, 1));
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.width = 1000;
    this.height = clamp(height / Math.max(width, 1) * 1000, 350, 1500);
    this.ground = this.height * 0.77;
    this.background.width = this.canvas.width;
    this.background.height = this.canvas.height;
    const c = this.background.getContext('2d')!;
    c.setTransform(this.canvas.width / 1000, 0, 0, this.canvas.height / this.height, 0, 0);
    c.fillStyle = '#070f18'; c.fillRect(0, 0, this.width, this.height);
    const glow = c.createRadialGradient(500, this.ground - 100, 0, 500, this.ground - 100, 530);
    glow.addColorStop(0, '#0c1b29'); glow.addColorStop(1, '#070f18');
    c.fillStyle = glow; c.fillRect(0, 0, this.width, this.height);
    c.strokeStyle = '#718697'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(35, this.ground); c.lineTo(965, this.ground); c.stroke();
    this.tree(c, 180, this.ground, 122, 17);
    this.tree(c, 817, this.ground, 152, 63);
    this.draw(performance.now(), 0, false);
  }
  private tree(c: CanvasRenderingContext2D, x: number, y: number, length: number, seed: number) {
    let state = seed;
    const random = () => { state = (state * 16807) % 2147483647; return state / 2147483647; };
    c.strokeStyle = '#9bacba'; c.lineCap = 'round';
    const branch = (bx: number, by: number, len: number, angle: number, depth: number) => {
      const ex = bx + Math.sin(angle) * len, ey = by - Math.cos(angle) * len;
      c.lineWidth = depth * 0.22 + 0.25;
      c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.stroke();
      if (depth === 0) return;
      branch(ex, ey, len * (0.52 + random() * 0.16), angle - 0.35 - random() * 0.38, depth - 1);
      branch(ex, ey, len * (0.5 + random() * 0.17), angle + 0.33 + random() * 0.38, depth - 1);
      if (depth > 2) branch(bx + (ex - bx) * 0.6, by + (ey - by) * 0.6, len * 0.43, angle + 0.65, depth - 2);
    };
    branch(x, y, length * 0.57, -0.03, 5);
  }
  draw(now: number, dt: number, economical: boolean) {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.background, 0, 0);
    c.setTransform(this.canvas.width / 1000, 0, 0, this.canvas.height / this.height, 0, 0);
    c.fillStyle = '#b8cfde';
    for (let i = 0; i < (economical ? 25 : this.stars.length); i++) {
      const s = this.stars[i];
      c.globalAlpha = 0.25 + 0.25 * (1 + Math.sin(now / 3800 + s.phase)) / 2;
      c.beginPath(); c.arc(s.x * 1000, s.y * this.ground * 0.9, s.r, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    this.person(c, dt);
  }
  private person(c: CanvasRenderingContext2D, dt: number) {
    const { x, velocity, direction } = this.control;
    const speed = Math.abs(velocity);
    if (direction !== this.lastDirection) {
      this.feet.forEach((f, i) => { f.anchor = f.x = x + (i ? 9 : -9); f.swing = false; });
      this.lastDirection = direction;
    }
    this.phase += speed * dt / 64;
    const moving = clamp(speed / 32, 0, 1);
    const hipY = this.ground - (39 - 6 * moving) + Math.sin(this.phase * Math.PI * 4) * 1.2 * moving;
    c.strokeStyle = '#d9e9f3'; c.lineWidth = 1.8; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i], p = (this.phase + i * 0.5) % 1;
      if (speed < 5) {
        f.x += (x + (i ? 6 : -6) - f.x) * (1 - Math.exp(-dt * 9));
        f.y += (0 - f.y) * (1 - Math.exp(-dt * 12));
        f.anchor = f.x; f.swing = false;
      } else if (p < 0.6) {
        if (f.swing) { f.anchor = f.end; f.swing = false; }
        if (Math.abs(f.anchor - x) > 32) f.anchor = x - direction * 18;
        f.x = f.anchor; f.y = 0;
      } else {
        if (!f.swing) { f.swing = true; f.end = x + direction * 45; }
        const t = (p - 0.6) / 0.4;
        f.x = f.anchor + (f.end - f.anchor) * (t * t * (3 - 2 * t));
        f.y = -Math.sin(t * Math.PI) * 11 * moving;
      }
      const footY = this.ground + f.y, dx = f.x - x, dy = footY - hipY;
      const len = Math.max(1, Math.hypot(dx, dy));
      const bend = Math.sqrt(Math.max(0, 21 * 21 - Math.min(len / 2, 21) ** 2));
      const kneeX = x + dx / 2 + direction * dy / len * bend;
      const kneeY = hipY + dy / 2 - direction * dx / len * bend;
      c.globalAlpha = i === 0 ? 0.5 : 1;
      c.beginPath(); c.moveTo(x, hipY); c.lineTo(kneeX, kneeY); c.lineTo(f.x, footY); c.lineTo(f.x + direction * 5, footY); c.stroke();
    }
    c.globalAlpha = 1;
    const lean = velocity / 175 * 3;
    const shoulderX = x + lean, shoulderY = hipY - 21;
    c.beginPath(); c.moveTo(x, hipY); c.lineTo(shoulderX, shoulderY); c.lineTo(shoulderX, shoulderY - 5); c.stroke();
    c.beginPath(); c.arc(shoulderX, shoulderY - 14, 8, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 2; i++) {
      const swing = Math.sin(this.phase * Math.PI * 2 + i * Math.PI) * moving;
      c.globalAlpha = i === 0 ? 0.5 : 1;
      c.beginPath(); c.moveTo(shoulderX, shoulderY + 2);
      c.lineTo(shoulderX + swing * 10, shoulderY + 14);
      c.lineTo(shoulderX + swing * 16 + direction * 4, shoulderY + 25 - Math.abs(swing) * 3); c.stroke();
    }
    c.globalAlpha = 1;
  }
  reset() {
    this.phase = 0; this.lastDirection = this.control.direction;
    this.feet.forEach((f, i) => { f.x = f.anchor = f.end = this.control.x + (i ? 6 : -6); f.y = 0; f.swing = false; });
  }
  dispose() { this.observer.disconnect(); }
}
