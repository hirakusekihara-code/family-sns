// マップ用の擬似データ（Mockデータ）
// x, y は地図の左上を 0、右下を 100 とした位置（%）です。
// 本物の地図に切り替えるときは、ここを緯度・経度に置き換えます。

export const spotPositions: Record<string, { x: number; y: number }> = {
  home: { x: 48, y: 56 },
  office: { x: 80, y: 14 },
  "junior-high": { x: 20, y: 22 },
  elementary: { x: 22, y: 76 },
  ground: { x: 74, y: 80 },
  supermarket: { x: 66, y: 44 },
  clinic: { x: 34, y: 42 },
};

export type MemberLocation = {
  memberId: string;
  spotId?: string; // スポットにいるとき
  x: number;
  y: number;
  moving: boolean; // 移動中
  minutesAgo: number; // 最終更新
  battery: number; // バッテリー残量（%）
};

export const memberLocations: MemberLocation[] = [
  { memberId: "papa", spotId: "office", ...spotPositions.office, moving: false, minutesAgo: 3, battery: 64 },
  { memberId: "mama", spotId: "home", ...spotPositions.home, moving: false, minutesAgo: 0, battery: 88 },
  { memberId: "hana", spotId: "junior-high", ...spotPositions["junior-high"], moving: false, minutesAgo: 5, battery: 42 },
  { memberId: "sora", x: 46, y: 78, moving: true, minutesAgo: 2, battery: 17 },
];
