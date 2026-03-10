export interface ImageItem {
  id: string;
  originalName: string;
  objectUrl: string;       // URL.createObjectURL() で生成（ブラウザ内のみ）
  width: number;
  height: number;
  size: number;
  format: string;
  // ユーザー設定
  displayName: string;
  group: string;
  crop: CropArea;
  ratioId: string; // どのアスペクト比を使っているか（'free' = フリークロップ）
  cropRotation: number; // クロップ枠の回転角度（度数、初期値 0）
  resize: { width: number; height: number } | null;
  quality: number;
  outputFormat: 'jpeg' | 'png' | 'webp';
  selected: boolean;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AspectRatio {
  id: string;
  width: number;
  height: number;
  label: string;
  source?: 'preset' | 'reference' | 'custom' | 'saved';
}

export interface ReferenceImage {
  id: string;
  objectUrl: string;       // ブラウザ内参照URL
  width: number;
  height: number;
  aspectRatio: number;
}

export interface ExportOptions {
  id: string;
  objectUrl: string;       // 元画像のobjectUrl（読み取り専用で使用）
  crop: CropArea;
  cropRotation: number;
  resize: { width: number; height: number } | null;
  quality: number;
  format: 'jpeg' | 'png' | 'webp';
  outputName: string;
  group: string;
}
