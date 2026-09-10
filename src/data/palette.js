// 전역 색상 팔레트 — 모든 스프라이트/이펙트/UI가 이 팔레트만 사용한다 (톤 통일)
// SF 우주정거장 톤: 어두운 우주 + 금속 플랫폼 + 붉은/보라/푸른 네온 포탈 & 회로 액센트
const PALETTE = {
  bgDark: 0x03040a,
  bgDark2: 0x070912,
  panel: 0x0f1420,
  panelLight: 0x1a2233,

  gridLine: 0x2a3550,       // 금속판 이음선 (은은하게만 사용)
  ground: 0x0a0e18,         // 우주 공간(보이드)
  groundPanel: 0x232c40,    // 금속 플랫폼
  pathBed: 0x2e3852,        // 통로 금속 바닥
  pathEdge: 0x111726,       // 통로 가장자리(플랫폼 경계)
  pathGlow: 0x5fd4ff,       // 통로 중앙 라이트 스트립

  goldTrim: 0x5fd4ff,       // UI 액센트 라인 (금테 대신 사이언 라인)
  warnStripe: 0xffb020,     // 경고 줄무늬(크레이트 등)

  textPrimary: 0xe8f4ff,
  textMuted: 0x7f93b8,
  textDim: 0x4d5a78,

  hullDark: 0x1b2436,
  hullMid: 0x2f3d58,
  hullLight: 0x4d5f80,
  hullEdge: 0x8fa8c8,

  danger: 0xff3b5c,
  warn: 0xffb020,
  good: 0x3ddc84,

  // 타워별 액센트(에너지 글로우) 색
  towerBasic: 0x4da8ff,
  towerCannon: 0xff9d4d,
  towerFrost: 0x6df0ff,
  towerSniper: 0xffcf4d,
  towerPoison: 0x7dff4d,
  towerTesla: 0xc04dff,

  // 적별 액센트 색
  enemyNormal: 0xff5d5d,
  enemyFast: 0xffe14d,
  enemyTank: 0xff7a3d,
  enemyEvasive: 0x8d6bff,
  enemyBoss: 0xff2d55,

  portalStart: 0xff3b5c,   // 적 스폰 포탈 (붉은 소용돌이)
  portalEnd: 0x9d4dff,     // 기지 포탈 (보라 소용돌이)
};

// hex 정수 <-> css 문자열 변환 헬퍼
function hexToCss(hex, alpha = 1) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

function lighten(hex, amt) {
  // 상한(255)뿐 아니라 하한(0)도 반드시 clamp 해야 한다 — 안 그러면 어두운
  // 색을 많이 darken()할 때 채널 값이 음수가 되어 최종 정수가 완전히 엉뚱한
  // (예: 새까만 색을 의도했는데 밝은 노란색이 나오는) 색으로 깨진다.
  const r = Math.max(0, Math.min(255, ((hex >> 16) & 0xff) + amt));
  const g = Math.max(0, Math.min(255, ((hex >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (hex & 0xff) + amt));
  return (r << 16) | (g << 8) | b;
}

function darken(hex, amt) {
  return lighten(hex, -amt);
}

// 결정적 의사난수 생성기 (같은 시드 -> 같은 배치, 배경 장식 등에 사용)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 울퉁불퉁한 얼룩 모양 (자연스러운 잔디 패치용)
function drawBlob(g, cx, cy, r, rng) {
  const pts = 7;
  g.beginPath();
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const rr = r * (0.75 + rng() * 0.5);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.7;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.fillPath();
}

// 우주 공간 배경 (별 + 은은한 성운) — 선/격자 없이 점과 소프트 블롭만 사용
function drawSpaceField(scene, w, h, seed) {
  const g = scene.add.graphics();
  g.fillStyle(PALETTE.ground, 1);
  g.fillRect(0, 0, w, h);
  const rng = mulberry32(seed);

  // 은은한 성운 블롭 (아주 낮은 알파)
  const nebulaColors = [0x2a1d4a, 0x1a2a4a, 0x3a1a2a];
  for (let i = 0; i < 5; i++) {
    const x = rng() * w, y = rng() * h, r = 160 + rng() * 220;
    g.fillStyle(nebulaColors[i % nebulaColors.length], 0.10 + rng() * 0.08);
    drawBlob(g, x, y, r, rng);
  }

  // 별
  for (let i = 0; i < Math.round((w * h) / 900); i++) {
    const x = rng() * w, y = rng() * h;
    const r = rng() < 0.85 ? (0.6 + rng() * 0.9) : (1.4 + rng() * 1.4);
    const a = 0.25 + rng() * 0.65;
    g.fillStyle(0xffffff, a);
    g.fillCircle(x, y, r);
  }
  return g;
}

// 우주정거장 갑판(금속 플랫폼) — 화면 전체가 아니라 경로를 따라 도는
// "섬" 형태. 반대쪽 모서리(왼쪽 아래/오른쪽 위 등)는 자연스럽게 우주로 남아서
// 플랫폼이 우주 한가운데 떠 있는 구도가 되도록 한다.
// 이음선은 선으로 긋지 않고 명암 패치로만 표현.
function drawStationDeck(scene, path, radius, seed) {
  const g = scene.add.graphics();
  const rng = mulberry32(seed);

  const samples = [];
  for (let d = 0; d <= path.totalLength; d += 16) samples.push(path.getPointAt(d));
  samples.push(path.getPointAt(path.totalLength));

  // 밑판 그림자(구조물 두께) — 기지가 우주 한가운데 "떠 있는" 것처럼 보이도록
  // 림 라이트보다 한 겹 더 바깥에 어두운 불투명 테두리를 깔아둔다. 반투명
  // 글로우가 아니라 완전히 불투명한 색이라 "바닥이 투명하다"는 문제와는 무관.
  g.fillStyle(darken(PALETTE.groundPanel, 55), 1);
  samples.forEach((p) => g.fillCircle(p.x, p.y, radius + 8));

  // 테두리 림 라이트 (완전 불투명한 밝은 테두리)
  g.fillStyle(lighten(PALETTE.groundPanel, 18), 1);
  samples.forEach((p) => g.fillCircle(p.x, p.y, radius));

  // 메인 갑판
  g.fillStyle(PALETTE.groundPanel, 1);
  samples.forEach((p) => g.fillCircle(p.x, p.y, radius - 10));

  // 명암 패치 (금속판 얼룩) — 갑판 안쪽에서만, 가장자리를 넘지 않도록 여유를 둠
  for (let i = 0; i < samples.length; i += 3) {
    const p = samples[i];
    const blobR = (radius - 10) * (0.18 + rng() * 0.16);
    const maxOff = Math.max(0, (radius - 14) - blobR);
    const off = (rng() - 0.5) * 2 * maxOff;
    const nx = Math.cos(p.angle + Math.PI / 2) * off, ny = Math.sin(p.angle + Math.PI / 2) * off;
    g.fillStyle(rng() < 0.5 ? PALETTE.hullDark : lighten(PALETTE.groundPanel, 14), 0.12 + rng() * 0.1);
    drawBlob(g, p.x + nx, p.y + ny, blobR, rng);
  }

  // 패널 이음새 느낌의 짧은 불투명 seam(선이 아니라 갑판 표면 질감용, 격자 아님)
  for (let i = 0; i < samples.length; i += 6) {
    const p = samples[i];
    const segR = (radius - 10) * (0.32 + rng() * 0.22);
    const maxOff = Math.max(0, (radius - 20) - segR);
    const off = (rng() - 0.5) * 2 * maxOff;
    const nx = Math.cos(p.angle + Math.PI / 2), ny = Math.sin(p.angle + Math.PI / 2);
    const cx = p.x + nx * off, cy = p.y + ny * off;
    const ang = p.angle + (rng() < 0.5 ? 0 : Math.PI / 2);
    g.lineStyle(2, darken(PALETTE.groundPanel, 30), 0.35);
    g.lineBetween(cx - Math.cos(ang) * segR * 0.5, cy - Math.sin(ang) * segR * 0.5,
      cx + Math.cos(ang) * segR * 0.5, cy + Math.sin(ang) * segR * 0.5);
  }

  // 가장자리 경고 줄무늬(사선 해치) — 플랫폼 끝임을 알리는 산업용 디테일
  for (let i = 0; i < samples.length; i += 4) {
    const p = samples[i];
    if (rng() < 0.4) continue;
    [1, -1].forEach((side) => {
      const nx = Math.cos(p.angle + Math.PI / 2) * side, ny = Math.sin(p.angle + Math.PI / 2) * side;
      const bx = p.x + nx * (radius - 15), by = p.y + ny * (radius - 15);
      g.fillStyle(rng() < 0.5 ? PALETTE.warnStripe : PALETTE.hullDark, 0.5);
      g.fillRect(bx - 3, by - 3, 6, 6);
    });
  }

  // 가장자리 착륙등 (경로 양옆을 따라 점점이 빛나는 점)
  for (let i = 0; i < samples.length; i += 5) {
    const p = samples[i];
    [1, -1].forEach((side) => {
      if (rng() < 0.45) return;
      const nx = Math.cos(p.angle + Math.PI / 2) * side * (radius - 7);
      const ny = Math.sin(p.angle + Math.PI / 2) * side * (radius - 7);
      g.fillStyle(PALETTE.pathGlow, 0.85);
      g.fillCircle(p.x + nx, p.y + ny, 2.1);
    });
  }

  return g;
}
