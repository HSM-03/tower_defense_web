// ============================================================
// 밸런스 데이터 — 수치는 전부 여기 한 곳에서만 관리한다.
// (나중에 실제 플레이 테스트로 다시 조정할 예정, 구조만 잘 잡아둠)
// ============================================================

const ECONOMY = {
  startingGold: 190,
  startingLife: 12,
  waveBreak: 4.0, // 웨이브 사이 대기시간(초)
};

// 업그레이드 레벨(1~3)별 공통 배율
const UPGRADE = {
  statMult: [1, 1.45, 2.05],       // 데미지/슬로우%/스턴시간/독dps
  rangeMult: [1, 1.12, 1.25],
  fireRateMult: [1, 1.15, 1.3],
  costMult: [0, 1.0, 1.9],         // 업그레이드 비용 = tower.cost * costMult[level]
};

const TOWERS = {
  basic: {
    id: "basic", name: "펄스 캐논", short: "단일 고화력",
    cost: 60, category: "physical", behavior: "single",
    range: 175, fireRate: 1.5, damage: 16,
    projectileSpeed: 640, color: "towerBasic",
    desc: "가장 가까운(가장 많이 진행한) 적 하나에 빠른 탄속으로 사격",
  },
  cannon: {
    id: "cannon", name: "플라즈마 모르타르", short: "광역 폭발",
    cost: 115, category: "area", behavior: "splash",
    range: 150, fireRate: 0.75, damage: 24, splashRadius: 78,
    projectileSpeed: 380, color: "towerCannon",
    desc: "포탄이 착탄 지점 주변 전체에 폭발 피해",
  },
  frost: {
    id: "frost", name: "크라이오 이미터", short: "감속 / CC",
    cost: 90, category: "control", behavior: "slow",
    range: 155, fireRate: 1.3, damage: 0,
    slowPct: 42, slowDuration: 1.5,
    projectileSpeed: 520, color: "towerFrost",
    desc: "범위 내 모든 적을 냉각시켜 이동속도 저하",
  },
  sniper: {
    id: "sniper", name: "레일건 타워", short: "장사거리 관통",
    cost: 165, category: "physical", behavior: "pierce",
    range: 340, fireRate: 0.42, damage: 42, pierceCount: 4,
    projectileSpeed: 1400, color: "towerSniper",
    desc: "가장 진행도가 높은 적부터 최대 4명을 한 줄로 관통",
  },
  poison: {
    id: "poison", name: "나노봇 타워", short: "도트 피해",
    cost: 125, category: "area", behavior: "poison",
    range: 150, fireRate: 0.95, damage: 5,
    poisonDps: 8, poisonDuration: 3.0, poisonMaxStacks: 3,
    projectileSpeed: 460, color: "towerPoison",
    desc: "명중 시 맹독을 주입, 중첩되는 지속 피해",
  },
  tesla: {
    id: "tesla", name: "테슬라 코일", short: "스턴 / CC",
    cost: 145, category: "control", behavior: "stun",
    range: 140, fireRate: 0.6, damage: 3, stunDuration: 1.1,
    color: "towerTesla",
    desc: "전격을 방출해 대상을 짧게 마비시킴",
  },
};

const TOWER_ORDER = ["basic", "cannon", "frost", "sniper", "poison", "tesla"];

const ENEMIES = {
  normal: {
    id: "normal", name: "드론", hp: 68, speed: 94, reward: 9,
    color: "enemyNormal", dodges: [], slowResist: 0, stunResist: 0, scale: 1.0,
    desc: "기본 정찰 드론. 체력·속도 모두 평범한 표준 위협.",
  },
  fast: {
    id: "fast", name: "인터셉터", hp: 36, speed: 186, reward: 10,
    color: "enemyFast", dodges: [], slowResist: 0, stunResist: 0, scale: 0.85,
    desc: "체력은 낮지만 매우 빠르게 돌진한다. 놓치기 쉬우니 주의.",
  },
  tank: {
    id: "tank", name: "저거너트", hp: 340, speed: 54, reward: 22,
    color: "enemyTank", dodges: [], slowResist: 0.6, stunResist: 0.65, scale: 1.35,
    desc: "느리지만 체력이 매우 높고, 감속·스턴 효과에 강하게 저항한다.",
  },
  evasive: {
    id: "evasive", name: "클로킹 유닛", hp: 52, speed: 122, reward: 17,
    color: "enemyEvasive", dodges: ["physical"], slowResist: 0, stunResist: 0, scale: 1.0,
    ghost: true,
    desc: "단일 사격형(펄스 캐논·레일건)의 물리 공격을 완전히 무시한다. 광역·도트·스턴 계열 타워로 상대해야 한다.",
  },
  boss: {
    id: "boss", name: "오버로드", hp: 2750, speed: 44, reward: 160,
    color: "enemyBoss", dodges: [], slowResist: 0.4, stunResist: 0.4, scale: 2.4,
    isBoss: true,
    desc: "6·12웨이브에 등장하는 미니보스. 체력이 압도적으로 높다.",
  },
};

const ENEMY_ORDER = ["normal", "fast", "tank", "evasive", "boss"];

// 웨이브 구성: spawns = [{type, count, interval}] 순차 스폰
function s(type, count, interval) { return { type, count, interval }; }

const WAVES = [
  { spawns: [s("normal", 7, 0.9)] },
  { spawns: [s("normal", 9, 0.8)] },
  { spawns: [s("normal", 6, 0.7), s("fast", 5, 0.5)] },
  { spawns: [s("fast", 10, 0.45)] },
  { spawns: [s("normal", 6, 0.6), s("tank", 3, 1.4)] },
  { spawns: [s("boss", 1, 1.0)], boss: true },
  { spawns: [s("fast", 7, 0.45), s("tank", 3, 1.2)] },
  { spawns: [s("normal", 6, 0.5), s("evasive", 4, 0.9)] },
  { spawns: [s("fast", 6, 0.4), s("evasive", 5, 0.8), s("tank", 2, 1.3)] },
  { spawns: [s("tank", 5, 1.1), s("evasive", 5, 0.7)] },
  { spawns: [s("normal", 6, 0.35), s("fast", 6, 0.35), s("tank", 4, 1.0), s("evasive", 6, 0.6)] },
  { spawns: [s("boss", 1, 1.0), s("evasive", 4, 0.6)], boss: true },
];
