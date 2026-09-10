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
    const hpMult = 1 + (this.waveIndex - 1) * 0.07;
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
