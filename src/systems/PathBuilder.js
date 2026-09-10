// 고정 경로 정의 + 거리 기반 이동 헬퍼 + 시각적 경로(금속 통로) 렌더링

// 경로 전체가 "왼쪽 위(NW) -> 가운데 -> 오른쪽 아래(SE)" 대각선 띠 안에서만
// 지그재그를 치도록 설계했다. 그래야 갑판(경로를 감싸는 땅)도 자연히 그 띠
// 안에만 생기고, 반대쪽 모서리(오른쪽 위/왼쪽 아래)는 손대지 않아도 우주로 남는다.
const PATH_WAYPOINTS = [
  { x: -60, y: 150 },
  { x: 260, y: 150 },
  { x: 260, y: 320 },
  { x: 500, y: 320 },
  { x: 500, y: 150 },
  { x: 640, y: 150 },
  { x: 640, y: 420 },
  { x: 900, y: 420 },
  { x: 900, y: 580 },
  { x: 1140, y: 580 },
  { x: 1140, y: 420 },
  { x: 1340, y: 420 },
];

class GamePath {
  constructor(points) {
    this.points = points;
    this.segLengths = [];
    this.cumLengths = [0];
    for (let i = 0; i < points.length - 1; i++) {
      const d = Phaser.Math.Distance.Between(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
      this.segLengths.push(d);
      this.cumLengths.push(this.cumLengths[i] + d);
    }
    this.totalLength = this.cumLengths[this.cumLengths.length - 1];
  }

  // dist(0..totalLength) -> {x,y,angle}
  getPointAt(dist) {
    dist = Phaser.Math.Clamp(dist, 0, this.totalLength);
    let i = 0;
    while (i < this.segLengths.length - 1 && dist > this.cumLengths[i + 1]) i++;
    const segStart = this.points[i];
    const segEnd = this.points[i + 1];
    const segLen = this.segLengths[i] || 1;
    const t = (dist - this.cumLengths[i]) / segLen;
    const x = Phaser.Math.Linear(segStart.x, segEnd.x, t);
    const y = Phaser.Math.Linear(segStart.y, segEnd.y, t);
    const angle = Phaser.Math.Angle.Between(segStart.x, segStart.y, segEnd.x, segEnd.y);
    return { x, y, angle };
  }

  closestDistanceTo(x, y) {
    // 배치 가능 여부 검사용: 점(x,y)에서 경로까지의 최단 거리
    let best = Infinity;
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i], b = this.points[i + 1];
      const d = distToSegment(x, y, a, b);
      if (d < best) best = d;
    }
    return best;
  }
}

function distToSegment(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
  t = Phaser.Math.Clamp(t, 0, 1);
  const cx = a.x + dx * t, cy = a.y + dy * t;
  return Phaser.Math.Distance.Between(px, py, cx, cy);
}

// 금속 통로 그래픽 — 어두운 테두리 + 플랫 메탈 바닥 + 가운데 라이트 스트립 하나만.
// (요청: 바닥/통로에 잔선·격자 없앰 — 두꺼운 스트로크 3겹으로만 표현)
function drawPathGraphics(scene, path) {
  const g = scene.add.graphics();
  g.setDepth(1);

  g.lineStyle(72, PALETTE.pathEdge, 1);
  drawPolyline(g, path.points);

  g.lineStyle(58, PALETTE.pathBed, 1);
  drawPolyline(g, path.points);

  g.lineStyle(5, PALETTE.pathGlow, 0.5);
  drawPolyline(g, path.points);

  // 통로 양옆에 작은 도관/리벳 디테일을 점으로만 찍는다(선이 아니라 점이라
  // 예전에 없앤 "격자/틱 선"과는 다름) — 그냥 금속 바닥처럼 밋밋하지 않도록.
  const rng = mulberry32(909);
  for (let d = 0; d <= path.totalLength; d += 34) {
    const p = path.getPointAt(d);
    const nx = Math.cos(p.angle + Math.PI / 2), ny = Math.sin(p.angle + Math.PI / 2);
    [1, -1].forEach((side) => {
      const ox = p.x + nx * side * 24, oy = p.y + ny * side * 24;
      g.fillStyle(PALETTE.hullEdge, 0.3 + rng() * 0.15);
      g.fillCircle(ox, oy, 1.5);
    });
  }
  for (let d = 0; d <= path.totalLength; d += 130) {
    const p = path.getPointAt(d);
    const nx = Math.cos(p.angle + Math.PI / 2), ny = Math.sin(p.angle + Math.PI / 2);
    [1, -1].forEach((side) => {
      const ox = p.x + nx * side * 24, oy = p.y + ny * side * 24;
      g.fillStyle(PALETTE.pathGlow, 0.55);
      g.fillCircle(ox, oy, 2.6);
    });
  }

  return g;
}

function drawPolyline(g, points) {
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  g.strokePath();
}
