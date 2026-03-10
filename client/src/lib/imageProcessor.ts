/**
 * クライアント側画像処理ユーティリティ
 * サーバー不要: すべてCanvas APIとFile APIで完結
 * 元ファイルは一切改変しない（読み取り専用で使用し、新規Blobを生成）
 */

export interface LoadedImage {
  id: string;
  originalName: string;
  objectUrl: string;     // URL.createObjectURL() で生成
  width: number;
  height: number;
  size: number;
  format: string;
}

/**
 * File → objectUrl + メタデータを取得（サーバーアップロード不要）
 * ブラウザのImage要素で読み込むことでEXIF回転も自動補正される
 */
export function loadImageFromFile(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // ブラウザはEXIF orientationを自動補正するので
      // naturalWidth/Height が補正後のサイズ
      resolve({
        id: crypto.randomUUID(),
        originalName: file.name,
        objectUrl,
        width: img.naturalWidth,
        height: img.naturalHeight,
        size: file.size,
        format: detectFormat(file),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`画像の読み込みに失敗: ${file.name}`));
    };
    img.src = objectUrl;
  });
}

/**
 * 参考画像の読み込み（比率検出用）
 */
export function loadReferenceImage(file: File): Promise<{
  id: string;
  objectUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
}> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        id: crypto.randomUUID(),
        objectUrl,
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspectRatio: img.naturalWidth / img.naturalHeight,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`参考画像の読み込みに失敗: ${file.name}`));
    };
    img.src = objectUrl;
  });
}

/**
 * ファイルフォーマット検出
 */
function detectFormat(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp',
    gif: 'gif', svg: 'svg', avif: 'avif',
    heic: 'heic', heif: 'heif', tiff: 'tiff', tif: 'tiff',
  };
  return mimeMap[ext] || file.type.split('/')[1] || 'unknown';
}

/**
 * Canvas APIで画像をトリミング・回転・リサイズ・フォーマット変換してBlobを生成
 * 元ファイルは一切変更しない（新規Canvas → 新規Blob）
 */
export async function processImage(
  imageUrl: string,
  crop: { x: number; y: number; width: number; height: number },
  options: {
    cropRotation?: number;
    resize?: { width: number; height: number } | null;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
  } = {}
): Promise<Blob> {
  const {
    cropRotation = 0,
    resize = null,
    quality = 90,
    format = 'jpeg',
  } = options;

  // 1. 元画像をImage要素で読み込み（読み取り専用）
  const img = await loadHtmlImage(imageUrl);

  // 出力サイズの決定
  const outputW = resize ? resize.width : Math.round(crop.width);
  const outputH = resize ? resize.height : Math.round(crop.height);

  // 2. 新規Canvasに描画（元ファイルには一切触れない）
  const canvas = new OffscreenCanvas(outputW, outputH);
  const ctx = canvas.getContext('2d')!;

  if (Math.abs(cropRotation) > 0.1) {
    // 回転あり: クロップ中心を基準に回転して描画
    const angleRad = (cropRotation * Math.PI) / 180;
    const cx = crop.x + crop.width / 2;
    const cy = crop.y + crop.height / 2;

    // スケール（リサイズ対応）
    const sx = outputW / crop.width;
    const sy = outputH / crop.height;

    ctx.save();
    ctx.translate(outputW / 2, outputH / 2);
    ctx.scale(sx, sy);
    ctx.rotate(-angleRad);
    ctx.drawImage(img, -cx, -cy);
    ctx.restore();
  } else {
    // 回転なし: シンプルなクロップ＆リサイズ
    ctx.drawImage(
      img,
      Math.round(crop.x), Math.round(crop.y),
      Math.round(crop.width), Math.round(crop.height),
      0, 0,
      outputW, outputH
    );
  }

  // 3. 新規BlobとしてエクスポートCanvasから生成
  const mimeType = format === 'jpeg' ? 'image/jpeg'
    : format === 'png' ? 'image/png'
    : 'image/webp';
  const q = format === 'png' ? undefined : quality / 100;

  return canvas.convertToBlob({ type: mimeType, quality: q });
}

/**
 * HTMLImageElement を Promise で読み込むヘルパー
 */
function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * objectUrlを安全に解放
 */
export function revokeObjectUrl(url: string) {
  try {
    URL.revokeObjectURL(url);
  } catch { /* ignore */ }
}
