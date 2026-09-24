// Demo-wide physical linear-speed limit; preserve direction and angular velocity.
export const MAX_BALL_SPEED = 8;
export function limitBallSpeed(qvel, address) {
  const speed = Math.hypot(qvel[address], qvel[address + 1], qvel[address + 2]);
  if (speed <= MAX_BALL_SPEED) return false;
  const scale = MAX_BALL_SPEED / speed;
  for (let i = 0; i < 3; i++) qvel[address + i] *= scale;
  return true;
}
