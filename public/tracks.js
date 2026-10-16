// tracks.js - Client-side coordinate tracks matching server geometry

function buildClientTracks() {
  const t1 = [];
  // 0..7: Outbound middle lane Right arm (East) from innermost (11,9) to tip (18,9)
  for (let x = 11; x <= 18; x++) t1.push({ x, y: 9 });
  // 8..15: Top column Right arm heading West: (18,8) to (11,8)
  for (let x = 18; x >= 11; x--) t1.push({ x, y: 8 });
  // 16..23: Top arm right column heading North: (10,7) to (10,0)
  for (let y = 7; y >= 0; y--) t1.push({ x: 10, y });
  // 24..31: Top arm left column heading South: (8,0) to (8,7)
  for (let y = 0; y <= 7; y++) t1.push({ x: 8, y });
  // 32..39: Left arm top column heading West: (7,8) to (0,8)
  for (let x = 7; x >= 0; x--) t1.push({ x, y: 8 });
  // 40..47: Left arm bottom column heading East: (0,10) to (7,10)
  for (let x = 0; x <= 7; x++) t1.push({ x, y: 10 });
  // 48..55: Bottom arm left column heading South: (8,11) to (8,18)
  for (let y = 11; y <= 18; y++) t1.push({ x: 8, y });
  // 56..63: Bottom arm right column heading North: (10,18) to (10,11)
  for (let y = 18; y >= 11; y--) t1.push({ x: 10, y });
  // 64..71: Right arm bottom column heading East: (11,10) to (18,10)
  for (let x = 11; x <= 18; x++) t1.push({ x, y: 10 });
  // 72..78: Inbound middle lane Right arm heading West: (18,9) down to (12,9)
  for (let x = 18; x >= 12; x--) t1.push({ x, y: 9 });
  // 79: Start Block (11,9)
  t1.push({ x: 11, y: 9, isStartBlock: true });
  // 80: Home Center (9,9)
  t1.push({ x: 9, y: 9, isHome: true });

  const t2 = t1.map(coord => {
    if (coord.isHome) return { x: 9, y: 9, isHome: true };
    return {
      x: 18 - coord.x,
      y: 18 - coord.y,
      isStartBlock: !!coord.isStartBlock
    };
  });

  return { T1: t1, T2: t2 };
}

window.PacheseTracks = buildClientTracks();
