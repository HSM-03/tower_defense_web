// ============================================================
// 모든 스프라이트를 코드로 직접 그려서 Phaser 텍스처로 굽는다.
// (외부 이미지 파일 전혀 없음 — 전부 Canvas2D 벡터 드로잉)
// ============================================================

const TextureForge = {
  build(scene) {
    this._buildParticles(scene);
    this._buildTowers(scene);
    this._buildEnemies(scene);
    this._buildProjectiles(scene);
    this._buildIcons(scene);
    this._buildProps(scene);
    this._buildPortals(scene);
    this._buildTierRing(scene);
  },

  // ---------- 공용 헬퍼 ----------
  _canvas(scene, key, size) {
    const tex = scene.textures.createCanvas(key, size, size);
    return { tex, ctx: tex.getContext(), size };
  },

  _finish(tex) { tex.refresh(); },

  _poly(sides, r, rot = -Math.PI / 2) {
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  },

  _pathPts(ctx, pts, cx, cy) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(cx + x, cy + y); else ctx.lineTo(cx + x, cy + y);
    });
    ctx.closePath();
  },

  _glowFill(ctx, x, y, r, colorHex, inner = 1, outer = 0) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexToCss(colorHex, inner));
    g.addColorStop(1, hexToCss(colorHex, outer));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  },

  _metalRadial(ctx, x, y, r, base) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r * 1.15);
    g.addColorStop(0, hexToCss(lighten(base, 70)));
    g.addColorStop(0.5, hexToCss(base));
    g.addColorStop(1, hexToCss(darken(base, 55)));
    return g;
  },

  // ============================================================
  // 파티클 (한 세트로 모든 이펙트에 재사용, tint로 색만 바꿔 씀)
  // ============================================================
  _buildParticles(scene) {
    // 부드러운 원형 도트
    {
      const { tex, ctx, size } = this._canvas(scene, "p_dot", 32);
      this._glowFill(ctx, 16, 16, 15, 0xffffff, 1, 0);
      this._finish(tex);
    }
    // 스파크(길쭉한 방울)
    {
      const { tex, ctx } = this._canvas(scene, "p_spark", 32);
      ctx.save();
      ctx.translate(16, 16);
      const g = ctx.createLinearGradient(-14, 0, 14, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,1)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
      ctx.restore();
      this._finish(tex);
    }
    // 파편(삼각 조각)
    {
      const { tex, ctx } = this._canvas(scene, "p_shard", 24);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(12, 2); ctx.lineTo(20, 18); ctx.lineTo(4, 20);
      ctx.closePath(); ctx.fill();
      this._finish(tex);
    }
    // 링(충격파)
    {
      const { tex, ctx } = this._canvas(scene, "p_ring", 64);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(32, 32, 26, 0, Math.PI * 2); ctx.stroke();
      this._finish(tex);
    }
  },

  // ============================================================
  // 타워 (베이스 + 터렛 분리 — 터렛만 회전시킴)
  // ============================================================
  _buildTowers(scene) {
    const S = 108, C = S / 2;
    for (const id of TOWER_ORDER) {
      const t = TOWERS[id];
      const accent = PALETTE[t.color];

      // ---- 베이스 ----
      {
        const { tex, ctx } = this._canvas(scene, `tw_${id}_base`, S);
        // 그림자
        ctx.save();
        this._glowFill(ctx, C, C + 10, 40, 0x000000, 0.45, 0);
        ctx.restore();

        const baseR = id === "cannon" ? 33 : id === "sniper" ? 30 : 31;
        // 8각 베이스
        ctx.save();
        ctx.fillStyle = this._metalRadial(ctx, C, C, baseR, PALETTE.hullDark);
        this._pathPts(ctx, this._poly(8, baseR), C, C);
        ctx.fill();
        ctx.strokeStyle = hexToCss(PALETTE.hullEdge, 0.9);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // 안쪽 패널
        ctx.save();
        ctx.fillStyle = hexToCss(PALETTE.hullMid);
        this._pathPts(ctx, this._poly(8, baseR - 7), C, C);
        ctx.fill();
        ctx.restore();

        // 볼트 8개
        ctx.fillStyle = hexToCss(PALETTE.hullEdge, 0.8);
        this._poly(8, baseR - 3).forEach(([x, y]) => {
          ctx.beginPath(); ctx.arc(C + x, C + y, 1.6, 0, Math.PI * 2); ctx.fill();
        });

        // 코어 글로우 링
        ctx.save();
        ctx.shadowColor = hexToCss(accent);
        ctx.shadowBlur = 14;
        ctx.strokeStyle = hexToCss(accent, 0.95);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(C, C, baseR - 15, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        this._glowFill(ctx, C, C, baseR - 15, accent, 0.55, 0);

        this._finish(tex);
      }

      // ---- 터렛 (오른쪽(+x)을 정면으로 그림, 런타임에 회전) ----
      {
        const { tex, ctx } = this._canvas(scene, `tw_${id}_turret`, S);
        ctx.translate(C, C);
        this._drawTurret(ctx, id, accent);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        this._finish(tex);
      }
    }
  },

  _drawTurret(ctx, id, accent) {
    const hullFill = this._metalRadial(ctx, 0, 0, 20, PALETTE.hullMid);
    switch (id) {
      case "basic": {
        // 트윈 배럴
        ctx.fillStyle = hexToCss(PALETTE.hullDark);
        [-6, 6].forEach((oy) => {
          ctx.save();
          ctx.translate(0, oy);
          this._roundRect(ctx, -2, -3.2, 26, 6.4, 3);
          ctx.fill();
          ctx.restore();
        });
        ctx.fillStyle = hexToCss(accent);
        [-6, 6].forEach((oy) => { ctx.beginPath(); ctx.arc(22, oy, 2.4, 0, Math.PI * 2); ctx.fill(); });
        // 허브
        ctx.fillStyle = hullFill;
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = hexToCss(PALETTE.hullEdge); ctx.lineWidth = 1.5; ctx.stroke();
        this._glowFill(ctx, 0, 0, 9, accent, 0.9, 0);
        break;
      }
      case "cannon": {
        ctx.fillStyle = hexToCss(PALETTE.hullDark);
        this._roundRect(ctx, -4, -9, 30, 18, 5); ctx.fill();
        ctx.fillStyle = hexToCss(darken(PALETTE.hullDark, 20));
        this._roundRect(ctx, 18, -11, 9, 22, 3); ctx.fill();
        ctx.fillStyle = hullFill;
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = hexToCss(PALETTE.hullEdge); ctx.lineWidth = 1.5; ctx.stroke();
        // 배기구 글로우
        ctx.fillStyle = hexToCss(accent);
        [[-6, -10], [-6, 10]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill(); });
        this._glowFill(ctx, 0, 0, 10, accent, 0.7, 0);
        break;
      }
      case "frost": {
        // 결정형 이미터 (프롱 4방향)
        ctx.save();
        ctx.strokeStyle = hexToCss(accent);
        ctx.shadowColor = hexToCss(accent);
        ctx.shadowBlur = 10;
        ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
          ctx.lineTo(Math.cos(a) * 19, Math.sin(a) * 19);
          ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = hullFill;
        this._pathPts(ctx, this._poly(6, 11), 0, 0); ctx.fill();
        ctx.strokeStyle = hexToCss(PALETTE.hullEdge); ctx.lineWidth = 1.5; ctx.stroke();
        this._glowFill(ctx, 0, 0, 8, accent, 0.95, 0);
        break;
      }
      case "sniper": {
        // 긴 레일 배럴 + 센서 혹
        ctx.fillStyle = hexToCss(PALETTE.hullDark);
        this._roundRect(ctx, -2, -2.4, 40, 4.8, 2.4); ctx.fill();
        ctx.fillStyle = hexToCss(accent);
        ctx.beginPath(); ctx.arc(38, 0, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = hullFill;
        this._roundRect(ctx, -12, -8, 20, 16, 4); ctx.fill();
        ctx.strokeStyle = hexToCss(PALETTE.hullEdge); ctx.lineWidth = 1.5;
        this._roundRect(ctx, -12, -8, 20, 16, 4); ctx.stroke();
        ctx.fillStyle = hexToCss(accent);
        ctx.beginPath(); ctx.arc(-2, 0, 3, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "poison": {
        // 캐니스터 + 노즐
        ctx.fillStyle = hullFill;
        this._pathPts(ctx, this._poly(6, 13), 0, 0); ctx.fill();
        ctx.strokeStyle = hexToCss(PALETTE.hullEdge); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = hexToCss(darken(PALETTE.hullDark, 10));
        this._roundRect(ctx, 8, -4, 16, 8, 3); ctx.fill();
        ctx.fillStyle = hexToCss(accent);
        ctx.beginPath(); ctx.arc(24, 0, 2.6, 0, Math.PI * 2); ctx.fill();
        [0, 2, 4].forEach((i) => {
          const a = i * (Math.PI * 2 / 6) + 0.5;
          ctx.beginPath(); ctx.arc(Math.cos(a) * 9, Math.sin(a) * 9, 1.8, 0, Math.PI * 2); ctx.fill();
        });
        this._glowFill(ctx, 0, 0, 9, accent, 0.5, 0);
        break;
      }
      case "tesla": {
        // 동심 코일 링
        ctx.save();
        ctx.shadowColor = hexToCss(accent);
        ctx.shadowBlur = 12;
        ctx.strokeStyle = hexToCss(accent);
        [7, 12, 17].forEach((r, i) => {
          ctx.globalAlpha = 1 - i * 0.22;
          ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        });
        ctx.restore();
        ctx.fillStyle = hullFill;
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        this._glowFill(ctx, 0, 0, 5, accent, 1, 0);
        // 노드 4개
        ctx.fillStyle = hexToCss(accent);
        [0, 1, 2, 3].forEach((i) => {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          ctx.beginPath(); ctx.arc(Math.cos(a) * 17, Math.sin(a) * 17, 2, 0, Math.PI * 2); ctx.fill();
        });
        break;
      }
    }
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  // ============================================================
  // 적 유닛
  // ============================================================
  _buildEnemies(scene) {
    const defs = [
      ["normal", 72], ["fast", 72], ["tank", 88], ["evasive", 72], ["boss", 132],
    ];
    for (const [id, size] of defs) {
      const e = ENEMIES[id];
      const accent = PALETTE[e.color];
      const { tex, ctx } = this._canvas(scene, `en_${id}`, size);
      const C = size / 2;
      ctx.translate(C, C);
      this._drawEnemyBody(ctx, id, accent, size);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this._finish(tex);
    }
  },

  _drawEnemyBody(ctx, id, accent, size) {
    const R = size * 0.34;
    const hullFill = this._metalRadial(ctx, 0, 0, R, PALETTE.hullDark);

    if (id === "fast") {
      // 화살촉형
      ctx.save();
      ctx.fillStyle = hullFill;
      ctx.beginPath();
      ctx.moveTo(R * 1.3, 0);
      ctx.lineTo(-R * 0.7, R * 0.75);
      ctx.lineTo(-R * 0.3, 0);
      ctx.lineTo(-R * 0.7, -R * 0.75);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = hexToCss(PALETTE.hullEdge); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = hexToCss(accent); ctx.lineWidth = 2.5;
      ctx.shadowColor = hexToCss(accent); ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(R * 0.9, 0); ctx.lineTo(-R * 0.1, 0); ctx.stroke();
      ctx.shadowBlur = 0;
      this._glowFill(ctx, R * 1.0, 0, 6, accent, 1, 0);
    } else if (id === "tank" || id === "boss") {
      // 중장갑 육각
      ctx.save();
      ctx.fillStyle = hullFill;
      this._pathPts(ctx, this._poly(6, R), 0, 0); ctx.fill();
      ctx.strokeStyle = hexToCss(PALETTE.hullEdge); ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      // 장갑판
      ctx.fillStyle = hexToCss(darken(PALETTE.hullMid, 10));
      this._pathPts(ctx, this._poly(6, R * 0.68), 0, 0); ctx.fill();
      // 코어
      ctx.save();
      ctx.shadowColor = hexToCss(accent); ctx.shadowBlur = id === "boss" ? 22 : 12;
      this._glowFill(ctx, 0, 0, R * 0.4, accent, 1, 0);
      ctx.strokeStyle = hexToCss(accent); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.42, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      // 외곽 스파이크/포탑 노드
      const nodeCount = id === "boss" ? 8 : 6;
      ctx.fillStyle = hexToCss(darken(PALETTE.hullDark, -10));
      this._poly(nodeCount, R * 0.95).forEach(([x, y]) => {
        ctx.beginPath(); ctx.arc(x, y, R * 0.11, 0, Math.PI * 2); ctx.fill();
      });
      if (id === "boss") {
        ctx.strokeStyle = hexToCss(accent, 0.8);
        ctx.lineWidth = 3;
        ctx.shadowColor = hexToCss(accent); ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(0, 0, R * 1.08, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (id === "evasive") {
      // 반투명 팬텀 (외곽 점선 글로우)
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = hullFill;
      this._pathPts(ctx, this._poly(6, R), 0, 0); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = hexToCss(accent, 0.95);
      ctx.shadowColor = hexToCss(accent); ctx.shadowBlur = 12;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, R * 1.02, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      this._glowFill(ctx, 0, 0, R * 0.5, accent, 0.75, 0);
      ctx.strokeStyle = hexToCss(0xffffff, 0.8);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.22, 0, Math.PI * 2); ctx.stroke();
    } else {
      // normal: 드론 (육각 + 눈)
      ctx.save();
      ctx.fillStyle = hullFill;
      this._pathPts(ctx, this._poly(6, R), 0, 0); ctx.fill();
      ctx.strokeStyle = hexToCss(PALETTE.hullEdge); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      ctx.fillStyle = hexToCss(darken(PALETTE.hullMid, 10));
      this._pathPts(ctx, this._poly(6, R * 0.62), 0, 0); ctx.fill();
      ctx.save();
      ctx.shadowColor = hexToCss(accent); ctx.shadowBlur = 10;
      this._glowFill(ctx, R * 0.25, 0, R * 0.3, accent, 1, 0);
      ctx.restore();
      // 후미 핀 2개
      ctx.fillStyle = hexToCss(PALETTE.hullDark);
      [-1, 1].forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(-R * 0.5, s * R * 0.3);
        ctx.lineTo(-R * 1.05, s * R * 0.55);
        ctx.lineTo(-R * 0.5, s * R * 0.6);
        ctx.closePath(); ctx.fill();
      });
    }
  },

  // ============================================================
  // 발사체
  // ============================================================
  _buildProjectiles(scene) {
    const specs = {
      basic: { shape: "bolt" }, cannon: { shape: "shell" }, frost: { shape: "shard" },
      sniper: { shape: "rail" }, poison: { shape: "vial" },
    };
    for (const id of Object.keys(specs)) {
      const t = TOWERS[id];
      const accent = PALETTE[t.color];
      const { tex, ctx } = this._canvas(scene, `pr_${id}`, 28);
      ctx.translate(14, 14);
      this._glowFill(ctx, 0, 0, 12, accent, 0.5, 0);
      ctx.fillStyle = hexToCss(lighten(accent, 60));
      ctx.shadowColor = hexToCss(accent);
      ctx.shadowBlur = 8;
      switch (specs[id].shape) {
        case "bolt":
          this._roundRect(ctx, -8, -2.4, 16, 4.8, 2.4); ctx.fill(); break;
        case "shell":
          ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); break;
        case "shard":
          ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, 5); ctx.lineTo(-4, -5); ctx.closePath(); ctx.fill(); break;
        case "rail":
          this._roundRect(ctx, -11, -1.6, 22, 3.2, 1.6); ctx.fill(); break;
        case "vial":
          ctx.beginPath(); ctx.ellipse(0, 0, 4, 6, 0, 0, Math.PI * 2); ctx.fill(); break;
      }
      this._finish(tex);
    }
  },

  // ============================================================
  // UI 아이콘
  // ============================================================
  _buildIcons(scene) {
    // 골드 코인
    {
      const { tex, ctx } = this._canvas(scene, "ic_coin", 32);
      ctx.translate(16, 16);
      ctx.fillStyle = this._metalRadial(ctx, 0, 0, 13, 0xffcc4d);
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#8a5a1a"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("G", 0, 1);
      this._finish(tex);
    }
    // 생명(하트/실드)
    {
      const { tex, ctx } = this._canvas(scene, "ic_life", 32);
      ctx.translate(16, 16);
      ctx.fillStyle = hexToCss(PALETTE.danger);
      ctx.shadowColor = hexToCss(PALETTE.danger); ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(0, 11);
      ctx.bezierCurveTo(-13, 1, -10, -10, 0, -4);
      ctx.bezierCurveTo(10, -10, 13, 1, 0, 11);
      ctx.closePath(); ctx.fill();
      this._finish(tex);
    }
    // 웨이브 깃발
    {
      const { tex, ctx } = this._canvas(scene, "ic_wave", 32);
      ctx.translate(16, 16);
      ctx.strokeStyle = hexToCss(PALETTE.hullEdge); ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(-8, 11); ctx.lineTo(-8, -11); ctx.stroke();
      ctx.fillStyle = hexToCss(PALETTE.pathGlow);
      ctx.shadowColor = hexToCss(PALETTE.pathGlow); ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(-8, -10); ctx.lineTo(9, -6); ctx.lineTo(-8, 0);
      ctx.closePath(); ctx.fill();
      this._finish(tex);
    }
    // X(설치 불가)
    {
      const { tex, ctx } = this._canvas(scene, "ic_x", 40);
      ctx.translate(20, 20);
      ctx.strokeStyle = hexToCss(PALETTE.danger); ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.shadowColor = hexToCss(PALETTE.danger); ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(9, 9); ctx.moveTo(9, -9); ctx.lineTo(-9, 9); ctx.stroke();
      this._finish(tex);
    }
    // 업그레이드 화살표
    {
      const { tex, ctx } = this._canvas(scene, "ic_upgrade", 32);
      ctx.translate(16, 16);
      ctx.fillStyle = hexToCss(PALETTE.good);
      ctx.shadowColor = hexToCss(PALETTE.good); ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(0, -11); ctx.lineTo(9, 3); ctx.lineTo(3, 3); ctx.lineTo(3, 11);
      ctx.lineTo(-3, 11); ctx.lineTo(-3, 3); ctx.lineTo(-9, 3);
      ctx.closePath(); ctx.fill();
      this._finish(tex);
    }
    // 배속 아이콘
    {
      const { tex, ctx } = this._canvas(scene, "ic_speed", 32);
      ctx.translate(16, 16);
      ctx.fillStyle = hexToCss(PALETTE.textPrimary);
      [-6, 2].forEach((ox) => {
        ctx.beginPath();
        ctx.moveTo(ox, -8); ctx.lineTo(ox + 8, 0); ctx.lineTo(ox, 8);
        ctx.closePath(); ctx.fill();
      });
      this._finish(tex);
    }
    // 상태이상 아이콘 (슬로우 / 독 / 스턴) - 적 머리 위에 표시
    {
      const { tex, ctx } = this._canvas(scene, "ic_slow", 24);
      ctx.translate(12, 12);
      ctx.strokeStyle = hexToCss(PALETTE.towerFrost);
      ctx.lineWidth = 2.2;
      ctx.shadowColor = hexToCss(PALETTE.towerFrost); ctx.shadowBlur = 5;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * -8, Math.sin(a) * -8);
        ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
        ctx.stroke();
      }
      this._finish(tex);
    }
    {
      const { tex, ctx } = this._canvas(scene, "ic_poison", 24);
      ctx.translate(12, 12);
      ctx.fillStyle = hexToCss(PALETTE.towerPoison);
      ctx.shadowColor = hexToCss(PALETTE.towerPoison); ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(0, -2, 7, Math.PI * 0.15, Math.PI * 0.85, false);
      ctx.arc(0, -2, 3, Math.PI * 0.85, Math.PI * 0.15, true);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 8, 2, 0, Math.PI * 2); ctx.fill();
      this._finish(tex);
    }
    {
      const { tex, ctx } = this._canvas(scene, "ic_stun", 24);
      ctx.translate(12, 12);
      ctx.fillStyle = hexToCss(PALETTE.towerTesla);
      ctx.shadowColor = hexToCss(PALETTE.towerTesla); ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.moveTo(2, -9); ctx.lineTo(-6, 2); ctx.lineTo(-1, 2);
      ctx.lineTo(-3, 9); ctx.lineTo(7, -2); ctx.lineTo(1, -2);
      ctx.closePath(); ctx.fill();
      this._finish(tex);
    }
  },

  // ============================================================
  // 배경 장식 소품 (크레이트 / 안테나 기둥 / 소행성) - SF 정거장 분위기
  // ============================================================
  _buildProps(scene) {
    // 위험 줄무늬 컨테이너 크레이트 (2가지 배치)
    ["prop_crate1", "prop_crate2"].forEach((key, i) => {
      const { tex, ctx } = this._canvas(scene, key, 44);
      const C = 22;
      this._glowFill(ctx, C + 2, C + 10, 14, 0x000000, 0.35, 0);
      ctx.save();
      ctx.translate(C, C);
      if (i === 1) ctx.rotate(0.5);
      ctx.fillStyle = this._metalRadial(ctx, 0, 0, 15, PALETTE.hullMid);
      this._roundRect(ctx, -15, -13, 30, 26, 3); ctx.fill();
      ctx.strokeStyle = hexToCss(PALETTE.hullDark, 0.8); ctx.lineWidth = 1.5;
      this._roundRect(ctx, -15, -13, 30, 26, 3); ctx.stroke();
      // 경고 줄무늬 (대각선 해칭, 모서리에만)
      ctx.save();
      this._roundRect(ctx, -15, -13, 30, 26, 3); ctx.clip();
      ctx.strokeStyle = hexToCss(PALETTE.warnStripe, 0.85);
      ctx.lineWidth = 3;
      for (let s = -20; s < 20; s += 7) { ctx.beginPath(); ctx.moveTo(s, -14); ctx.lineTo(s + 8, 14); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = hexToCss(PALETTE.hullMid);
      ctx.fillRect(-15, -3, 30, 6);
      ctx.strokeStyle = hexToCss(PALETTE.hullDark, 0.7); ctx.strokeRect(-15, -3, 30, 6);
      ctx.restore();
      this._finish(tex);
    });

    // 안테나 / 기술 기둥
    {
      const { tex, ctx } = this._canvas(scene, "prop_pillar", 40);
      const C = 20;
      this._glowFill(ctx, C, C + 12, 10, 0x000000, 0.35, 0);
      ctx.fillStyle = this._metalRadial(ctx, C, C + 6, 8, PALETTE.hullMid);
      this._roundRect(ctx, C - 6, C - 2, 12, 16, 2); ctx.fill();
      ctx.fillStyle = hexToCss(PALETTE.hullDark);
      this._roundRect(ctx, C - 3, C - 18, 6, 18, 2); ctx.fill();
      ctx.save();
      ctx.shadowColor = hexToCss(PALETTE.pathGlow); ctx.shadowBlur = 8;
      ctx.fillStyle = hexToCss(PALETTE.pathGlow);
      ctx.beginPath(); ctx.arc(C, C - 18, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      this._finish(tex);
    }

    // 소행성 / 잔해 (보이드 공간 장식용)
    {
      const { tex, ctx } = this._canvas(scene, "prop_asteroid", 40);
      const C = 20;
      ctx.fillStyle = this._metalRadial(ctx, C, C, 17, 0x3a3448);
      this._pathPts(ctx, this._poly(7, 17), C, C); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1;
      this._pathPts(ctx, this._poly(5, 8), C - 4, C + 3); ctx.stroke();
      this._finish(tex);
    }

    // 포탈 주변 크리스탈 무더기 (2색)
    ["prop_crystal_r", "prop_crystal_p"].forEach((key, i) => {
      const accent = i === 0 ? PALETTE.portalStart : PALETTE.portalEnd;
      const { tex, ctx } = this._canvas(scene, key, 44);
      const C = 22;
      this._glowFill(ctx, C, C + 8, 14, 0x000000, 0.3, 0);
      const rocks = [[-7, 4, 9], [7, 5, 8], [0, -2, 7]];
      rocks.forEach(([dx, dy, r]) => {
        ctx.fillStyle = this._metalRadial(ctx, C + dx, C + dy, r, 0x2a2438);
        this._pathPts(ctx, this._poly(6, r), C + dx, C + dy); ctx.fill();
      });
      ctx.save();
      ctx.shadowColor = hexToCss(accent); ctx.shadowBlur = 8;
      ctx.fillStyle = hexToCss(accent, 0.95);
      [[-4, -3, 6], [5, -1, 5], [1, -8, 5]].forEach(([dx, dy, h]) => {
        ctx.beginPath();
        ctx.moveTo(C + dx, C + dy - h); ctx.lineTo(C + dx - 3, C + dy + 2); ctx.lineTo(C + dx + 3, C + dy + 2);
        ctx.closePath(); ctx.fill();
      });
      ctx.restore();
      this._finish(tex);
    });

    // 우주 소행성 2종 추가 (크기/형태 다양화)
    ["prop_asteroid2", "prop_asteroid3"].forEach((key, i) => {
      const { tex, ctx } = this._canvas(scene, key, 44);
      const C = 22, r = 14 + i * 4;
      ctx.fillStyle = this._metalRadial(ctx, C, C, r, i === 0 ? 0x352f42 : 0x2e2a3a);
      this._pathPts(ctx, this._poly(8, r), C, C); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1;
      this._pathPts(ctx, this._poly(5, r * 0.45), C - 3, C + 2); ctx.stroke();
      this._pathPts(ctx, this._poly(4, r * 0.3), C + 4, C - 3); ctx.stroke();
      this._finish(tex);
    });

    // 멀리 떠 있는 행성 2종 (원경 장식 - 아주 큼직하게, 은은한 그러데이션)
    [{ key: "prop_planet1", c1: 0x3a6fbf, c2: 0x162a4a, ring: false }, { key: "prop_planet2", c1: 0x8a4dd0, c2: 0x2a1548, ring: true }].forEach((spec) => {
      const size = 176;
      const { tex, ctx } = this._canvas(scene, spec.key, size);
      const C = size / 2, r = size * 0.34;
      if (spec.ring) {
        ctx.save();
        ctx.translate(C, C);
        ctx.rotate(-0.35);
        ctx.strokeStyle = hexToCss(lighten(spec.c1, 30), 0.5);
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.55, r * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      const grad = ctx.createRadialGradient(C - r * 0.35, C - r * 0.35, r * 0.15, C, C, r);
      grad.addColorStop(0, hexToCss(lighten(spec.c1, 40)));
      grad.addColorStop(0.55, hexToCss(spec.c1));
      grad.addColorStop(1, hexToCss(spec.c2));
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(C, C, r, 0, Math.PI * 2); ctx.fill();
      // 표면 밴드
      ctx.save();
      ctx.beginPath(); ctx.arc(C, C, r, 0, Math.PI * 2); ctx.clip();
      ctx.strokeStyle = hexToCss(spec.c2, 0.35);
      ctx.lineWidth = 5;
      for (let b = -2; b <= 2; b++) {
        ctx.beginPath();
        ctx.ellipse(C, C + b * r * 0.32, r * 1.05, r * 0.22, -0.25, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      if (spec.ring) {
        ctx.save();
        ctx.translate(C, C);
        ctx.rotate(-0.35);
        ctx.strokeStyle = hexToCss(lighten(spec.c1, 45), 0.85);
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.55, r * 0.4, 0, Math.PI, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      this._finish(tex);
    });

    // 반짝이는 우주 잔해 (아주 작은 글로우 파편, 색 변형 가능)
    {
      const { tex, ctx } = this._canvas(scene, "prop_debris", 16);
      ctx.translate(8, 8);
      this._glowFill(ctx, 0, 0, 7, 0xbfd8ff, 1, 0);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-1.5, 2); ctx.lineTo(-1.5, -2); ctx.closePath(); ctx.fill();
      this._finish(tex);
    }

    // 얼음 결정 소행성 (다른 소행성들과 확실히 구분되는 실루엣/색)
    {
      const { tex, ctx } = this._canvas(scene, "prop_ice", 44);
      const C = 22, r = 16;
      ctx.save();
      ctx.shadowColor = "#8fd8ff"; ctx.shadowBlur = 10;
      ctx.fillStyle = this._metalRadial(ctx, C, C, r, 0x2f5570);
      const pts = [[0, -r], [r * 0.7, -r * 0.3], [r * 0.55, r * 0.6], [-r * 0.2, r], [-r * 0.9, r * 0.2], [-r * 0.6, -r * 0.6]];
      ctx.beginPath();
      pts.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(C + x, C + y); else ctx.lineTo(C + x, C + y); });
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(180,230,255,0.7)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(C - 4, C - 8); ctx.lineTo(C + 3, C + 2); ctx.lineTo(C - 2, C + 9); ctx.stroke();
      this._finish(tex);
    }

    // 파손된 위성/잔해 (금속판 + 안테나 + 경고등 — 바위와 확실히 다른 인공물 실루엣)
    {
      const { tex, ctx } = this._canvas(scene, "prop_wreck", 48);
      const C = 24;
      ctx.save();
      ctx.translate(C, C);
      ctx.rotate(0.6);
      ctx.fillStyle = this._metalRadial(ctx, 0, 0, 14, PALETTE.hullDark);
      this._roundRect(ctx, -16, -8, 24, 16, 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1;
      this._roundRect(ctx, -16, -8, 24, 16, 2); ctx.stroke();
      ctx.strokeStyle = hexToCss(PALETTE.hullEdge, 0.5); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(8, 0); ctx.stroke();
      ctx.fillStyle = hexToCss(PALETTE.hullMid);
      ctx.fillRect(6, -10, 3, 20);
      ctx.restore();
      ctx.save();
      ctx.shadowColor = hexToCss(PALETTE.danger); ctx.shadowBlur = 6;
      ctx.fillStyle = hexToCss(PALETTE.danger);
      ctx.beginPath(); ctx.arc(C + 14, C - 6, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      this._finish(tex);
    }

    // 은은한 성운 뭉게구름 (소품으로 배치 가능한 큼직한 반투명 가스)
    ["prop_nebula1", "prop_nebula2"].forEach((key, i) => {
      const size = 140;
      const { tex, ctx } = this._canvas(scene, key, size);
      const C = size / 2;
      const col = i === 0 ? 0x6a4dc0 : 0x2d6ec0;
      const rng = mulberry32(500 + i);
      for (let k = 0; k < 5; k++) {
        const x = C + (rng() - 0.5) * size * 0.5, y = C + (rng() - 0.5) * size * 0.5;
        this._glowFill(ctx, x, y, size * 0.28, col, 0.22, 0);
      }
      this._finish(tex);
    });
  },

  // ============================================================
  // 시작/도착 포탈 (금속 링 프레임 + 회전하는 에너지 소용돌이)
  // ============================================================
  _buildPortals(scene) {
    const specs = { start: PALETTE.portalStart, end: PALETTE.portalEnd };
    for (const key of Object.keys(specs)) {
      const ring = specs[key];
      const core = darken(ring, 40);
      // 금속 링 프레임
      {
        const { tex, ctx } = this._canvas(scene, `portal_${key}_frame`, 112);
        const C = 56;
        ctx.fillStyle = this._metalRadial(ctx, C, C, 50, PALETTE.hullMid);
        ctx.beginPath(); ctx.arc(C, C, 50, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = hexToCss(PALETTE.hullEdge, 0.9); ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = hexToCss(PALETTE.hullDark);
        ctx.beginPath(); ctx.arc(C, C, 38, 0, Math.PI * 2); ctx.fill();
        // 링 위 패널 노드
        ctx.fillStyle = hexToCss(PALETTE.hullLight);
        this._poly(12, 44).forEach(([x, y]) => { ctx.beginPath(); ctx.arc(C + x, C + y, 2.6, 0, Math.PI * 2); ctx.fill(); });
        ctx.save();
        ctx.shadowColor = hexToCss(ring); ctx.shadowBlur = 10;
        ctx.strokeStyle = hexToCss(ring, 0.9); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(C, C, 39, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        this._finish(tex);
      }
      // 소용돌이 (회전 애니메이션용 별도 레이어)
      {
        const { tex, ctx } = this._canvas(scene, `portal_${key}_swirl`, 80);
        const C = 40;
        this._glowFill(ctx, C, C, 36, ring, 0.5, 0);
        this._glowFill(ctx, C, C, 26, core, 0.95, 0);
        ctx.save();
        ctx.strokeStyle = hexToCss(lighten(ring, 60), 0.85);
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) {
          const a0 = (i / 3) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(C, C, 20, a0, a0 + Math.PI * 0.6);
          ctx.stroke();
        }
        ctx.restore();
        this._finish(tex);
      }
    }
  },

  // ============================================================
  // 타워 업그레이드 등급 링 (레벨 2/3에서 타워 주위에 표시)
  // ============================================================
  _buildTierRing(scene) {
    const { tex, ctx } = this._canvas(scene, "tier_ring", 96);
    const C = 48;
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#ffffff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 7]);
    ctx.beginPath(); ctx.arc(C, C, 40, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    this._finish(tex);
  },
};
