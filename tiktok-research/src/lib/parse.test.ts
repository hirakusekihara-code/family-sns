import { test } from "node:test";
import assert from "node:assert/strict";
import { absolutize, normalizeProfile, normalizeVideo, parseInput, safeFilename } from "./parse.ts";
import { compact, extractHashtags, median, research, sortVideos, toCsv } from "./stats.ts";

test("parseInput: ユーザー名とURLを見分ける", () => {
  assert.deepEqual(parseInput("@khaby.lame"), { kind: "user", username: "khaby.lame" });
  assert.deepEqual(parseInput(" khaby.lame "), { kind: "user", username: "khaby.lame" });
  assert.deepEqual(parseInput("https://www.tiktok.com/@khaby.lame?lang=ja"), { kind: "user", username: "khaby.lame" });
  assert.deepEqual(parseInput("tiktok.com/@abc_1/"), { kind: "user", username: "abc_1" });
  assert.deepEqual(parseInput("https://www.tiktok.com/@abc/video/7234567890123456789?is_from_webapp=1"), {
    kind: "video",
    url: "https://www.tiktok.com/@abc/video/7234567890123456789",
    id: "7234567890123456789",
    username: "abc",
  });
  assert.equal(parseInput("https://vm.tiktok.com/ZMabcdef/").kind, "video");
  assert.equal(parseInput("https://www.tiktok.com/t/ZTabc/").kind, "video");
  assert.equal(parseInput("").kind, "invalid");
  assert.equal(parseInput("bad name!").kind, "invalid");
  assert.equal(parseInput("https://evil.com/@abc").kind, "invalid");
  assert.equal(parseInput("https://tiktok.com.evil.com/@abc").kind, "invalid");
});

test("normalizeProfile: tikwm / tiktok.com の形を読む", () => {
  const p = normalizeProfile(
    {
      user: { id: "1", uniqueId: "abc", nickname: "ABC", avatarLarger: "https://x/a.jpg", signature: "hi", verified: true, privateAccount: false },
      stats: { followerCount: 10, followingCount: 2, heartCount: 300, videoCount: 4 },
    },
    "tikwm",
  );
  assert.equal(p?.username, "abc");
  assert.equal(p?.followers, 10);
  assert.equal(p?.likes, 300);
  assert.equal(p?.verified, true);
  // statsV2 は文字列の数値
  const p2 = normalizeProfile({ user: { uniqueId: "x" }, stats: { followerCount: 1 }, statsV2: { followerCount: "9999999999" } }, "tiktok");
  assert.equal(p2?.followers, 9999999999);
  assert.equal(normalizeProfile({}, "tikwm"), null);
});

test("normalizeVideo と absolutize", () => {
  const v = normalizeVideo({ video_id: "123456", title: "t #a", cover: "/video/cover/1.webp", play_count: 5, images: ["a", "b"] }, "me");
  assert.equal(v?.cover, "https://www.tikwm.com/video/cover/1.webp");
  assert.equal(v?.author, "me");
  assert.equal(v?.isPhoto, true);
  assert.equal(v?.imageCount, 2);
  assert.equal(absolutize("//cdn/x"), "https://cdn/x");
  assert.equal(normalizeVideo({}), null);
});

test("research / sort / csv", () => {
  const base = { author: "a", cover: "", duration: 10, comments: 0, shares: 0, saves: 0, pinned: false, isPhoto: false, imageCount: 0, music: "" };
  const vids = [
    { ...base, id: "1", title: "#Cat #dog", createdAt: 1_700_000_000, views: 100, likes: 10 },
    { ...base, id: "2", title: "#cat, \"quoted\"", createdAt: 1_700_604_800, views: 300, likes: 30 },
  ];
  const r = research(vids, null);
  assert.equal(r.totalViews, 400);
  assert.equal(r.avgViews, 200);
  assert.equal(r.engagementRate, 0.1);
  assert.equal(r.postsPerWeek, 2);
  assert.equal(r.hashtags[0].tag, "#cat");
  assert.equal(r.hashtags[0].count, 2); // 句読点はタグに含めない
  assert.equal(sortVideos(vids, "views")[0].id, "2");
  assert.equal(median([3, 1, 2, 10]), 2.5);
  assert.deepEqual(extractHashtags("a #x #Y"), ["#x", "#y"]);
  const csv = toCsv(vids);
  assert.ok(csv.startsWith("﻿"));
  assert.ok(csv.includes('"#cat, ""quoted"""'));
  assert.equal(compact(12345), "1.2万");
  assert.equal(safeFilename('a/b:c*"d'), "a_b_c_d");
});
