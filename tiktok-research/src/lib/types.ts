// アプリ全体で使う、TikTok のデータを整えた形

export type Profile = {
  id: string;
  username: string; // @ のあとの名前（uniqueId）
  secUid: string; // TikTok 内部のユーザーID（投稿一覧の取得に使う）
  nickname: string;
  avatar: string;
  bio: string;
  verified: boolean;
  isPrivate: boolean;
  region: string;
  followers: number;
  following: number;
  likes: number;
  videoCount: number;
  source: "tikwm" | "tiktok" | "mock";
};

export type Video = {
  id: string;
  author: string; // username
  title: string;
  cover: string;
  duration: number; // 秒
  createdAt: number; // UNIX 秒
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  pinned: boolean;
  isPhoto: boolean; // 写真スライドショー投稿
  imageCount: number;
  music: string;
};

export type VideoPage = {
  videos: Video[];
  cursor: string;
  hasMore: boolean;
};

// /api/download で取得できるファイルの種類
export type MediaKind = "hd" | "sd" | "wm" | "music" | "image";

// API の失敗はすべてこの形で返す
export type ApiError = { error: string };
