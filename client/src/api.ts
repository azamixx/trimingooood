/**
 * クライアント完結版 API
 * サーバー通信は一切行わない。すべての処理はブラウザ内で完結する。
 */

// ImageCardのCanvas描画で使用 - objectUrlをそのまま返す
export function getFullImageUrl(objectUrl: string) {
  return objectUrl;
}
