export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export class WalkerControl {
  x = 500;
  velocity = 0;
  target = 500;
  direction = 1;
  distance = 0;
  lastSeen = -Infinity;
  private lastSample = 0;
  readonly left = 95;
  readonly right = 905;
  setTarget(normalizedX: number, now: number, smooth = true) {
    const next = this.left + clamp(normalizedX, 0, 1) * (this.right - this.left);
    const dt = this.lastSample ? clamp((now - this.lastSample) / 1000, 0.001, 0.25) : 1;
    if (Math.abs(next - this.target) > 4) this.target += (next - this.target) * (smooth ? 1 - Math.exp(-dt / 0.075) : 1);
    this.lastSeen = now;
    this.lastSample = now;
  }
  update(dt: number, now: number, pointer = false) {
    dt = clamp(dt, 0, 0.05);
    const error = this.target - this.x;
    const available = pointer || now - this.lastSeen <= 250;
    const desired = available && Math.abs(error) > 4 ? Math.sign(error) * Math.min(175, Math.abs(error) * 3.2, Math.sqrt(2 * 480 * Math.abs(error))) : 0;
    this.velocity += clamp(desired - this.velocity, -480 * dt, 480 * dt);
    if (Math.abs(this.velocity) < 0.3 && desired === 0) this.velocity = 0;
    const old = this.x;
    this.x = clamp(this.x + this.velocity * dt, this.left, this.right);
    this.distance += Math.abs(this.x - old);
    if (Math.abs(this.velocity) > 3) this.direction = Math.sign(this.velocity);
  }
  reset() {
    this.x = this.target = 500;
    this.velocity = this.distance = 0;
    this.direction = 1;
    this.lastSeen = -Infinity;
    this.lastSample = 0;
  }
}
