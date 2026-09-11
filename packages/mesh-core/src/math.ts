import type { Vec3 } from './types.js';

export const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale3 = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length3 = (a: Vec3): number => Math.sqrt(dot3(a, a));
export const normalize3 = (a: Vec3): Vec3 => {
  const len = length3(a);
  return len > 1e-12 ? scale3(a, 1 / len) : [0, 0, 0];
};
export const distance3 = (a: Vec3, b: Vec3): number => length3(sub3(a, b));

export function triangleNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  return normalize3(cross3(sub3(b, a), sub3(c, a)));
}

export function triangleArea(a: Vec3, b: Vec3, c: Vec3): number {
  return 0.5 * length3(cross3(sub3(b, a), sub3(c, a)));
}
