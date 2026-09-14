// 웨이브 진행 & 스폰 그룹 순차 처리

class WaveManager {
  constructor(scene) {
    this.scene = scene;
    this.waveIndex = 0;
    this.groupIndex = 0;
    this.spawnedInGroup = 0;
    this.timer = 0;
    this.spawning = false;
    this.breakTimer = 0;
    this.finished = false;
  }

  start() { this.startNextWave(); }

  update(dt) {
    if (this.finished) return;
    if (this.spawning) {
      this.timer += dt;
      const group = this._currentGroup();
      if (!group) { this.spawning = false; return; }
      if (this.timer >= group.interval) {
        this.timer = 0;
        this._spawnOne(group);
      }
    } else if (this.waveIndex > 0) {
      if (this.scene.enemies.length === 0) {
        this.breakTimer += dt;
        if (this.breakTimer >= ECONOMY.waveBreak) {
          this.breakTimer = 0;
          this.startNextWave();
        }
      }
    }
  }

  _currentGroup() {
    const wave = WAVES[this.waveIndex - 1];
    if (!wave) return null;
    return wave.spawns[this.groupIndex] || null;
  }

  startNextWave() {
    this.waveIndex++;
    if (this.waveIndex > WAVES.length) {
      this.finished = true;
      this.scene.onAllWavesCleared();
      return;
    }
    this.groupIndex = 0;
    this.spawnedInGroup = 0;
    this.timer = 0;
    this.spawning = true;
    const wave = WAVES[this.waveIndex - 1];
    this.scene.onWaveStart(this.waveIndex, wave);
  }

  _spawnOne(group) {
    // 웨이브별 체력 증가폭 — 너무 쉬웠던 0.055와 너무 가팔랐던 0.09 사이로 조정.
    let hpMult = 1 + (this.waveIndex - 1) * 0.07;
    // 중간보스(6웨이브)를 잡고 나면 그 전까지 쌓아둔 골드/타워 수 때문에
    // 체감 난이도가 뚝 떨어진다는 피드백이 있어 — 7웨이브부터 한 단계
    // 더 끌어올려서 그 낙차를 메운다 (웨이브 구성의 적 "수" 증가와 별개로,
    // 개별 체력도 한 번 더 점프시킴).
    if (this.waveIndex > 6) hpMult += 0.18;
    const enemy = new Enemy(this.scene, group.type, hpMult);
    this.scene.onEnemySpawned(enemy, this.waveIndex);
    this.spawnedInGroup++;
    if (this.spawnedInGroup >= group.count) {
      this.spawnedInGroup = 0;
      this.groupIndex++;
      this.timer = 0;
      if (!this._currentGroup()) this.spawning = false;
    }
  }
}
