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
