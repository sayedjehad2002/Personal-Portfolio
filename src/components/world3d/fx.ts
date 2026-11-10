import * as THREE from "three";

/**
 * Small particle pool for the world's visual effects: splashes, breath, smoke, sparks, fireworks.
 * One instanced mesh, one draw call. Each particle has its own colour, grows or shrinks over its life,
 * and can fall (positive gravity) or float up (negative).
 */
type P = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; s0: number; s1: number; g: number };

export class Fx {
  readonly mesh: THREE.InstancedMesh;
  private p: P[];
  private n = 0;
  private m = new THREE.Matrix4();
  private c = new THREE.Color();

  constructor(count = 160) {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.82, depthWrite: false }), count);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.p = Array.from({ length: count }, () => ({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, age: 1, life: 1, s0: 0, s1: 0, g: 0 }));
    for (let i = 0; i < count; i++) {
      this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
      this.mesh.setColorAt(i, this.c.set("#FFFFFF"));
    }
  }

  /** s0 and s1 are the radius at birth and at the end of its life; g pulls it down (or lifts it when negative). */
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, color: string, g = 0) {
    const i = this.n++ % this.p.length;
    Object.assign(this.p[i], { x, y, z, vx, vy, vz, age: 0, life, s0, s1, g });
    this.mesh.setColorAt(i, this.c.set(color));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** a round burst of sparks (fireworks, a landing on hot stone) */
  burst(x: number, y: number, z: number, count: number, speed: number, life: number, size: number, colors: string[], g = 2) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - up * up) * speed * (0.6 + Math.random() * 0.5);
      this.spawn(x, y, z, Math.cos(a) * r, up * speed * 0.9, Math.sin(a) * r * 0.5, life * (0.7 + Math.random() * 0.5), size, 0, colors[k % colors.length], g);
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i];
      if (p.age >= p.life) continue;
      p.age += dt;
      p.vy -= p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = Math.min(1, p.age / p.life);
      // quick to appear, slow to go
      const s = p.age >= p.life ? 0 : (p.s0 + (p.s1 - p.s0) * t) * Math.min(1, t * 8) * (t > 0.7 ? (1 - t) / 0.3 : 1);
      this.mesh.setMatrixAt(i, this.m.makeScale(s, s, s).setPosition(p.x, p.y, p.z));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
