import { create } from 'zustand';
import type { ImageItem, AspectRatio, ReferenceImage } from './types';

const SAVED_RATIOS_KEY = 'trimminGooood_savedRatios';

const DEFAULT_RATIOS: AspectRatio[] = [
  { id: 'r-1-1', width: 1, height: 1, label: '1:1', source: 'preset' },
  { id: 'r-4-3', width: 4, height: 3, label: '4:3', source: 'preset' },
  { id: 'r-16-9', width: 16, height: 9, label: '16:9', source: 'preset' },
  { id: 'r-3-2', width: 3, height: 2, label: '3:2', source: 'preset' },
  { id: 'r-9-16', width: 9, height: 16, label: '9:16', source: 'preset' },
  { id: 'r-2-3', width: 2, height: 3, label: '2:3', source: 'preset' },
];

// localStorage から保存済み比率を読み込み
function loadSavedRatios(): AspectRatio[] {
  try {
    const data = localStorage.getItem(SAVED_RATIOS_KEY);
    if (data) return JSON.parse(data) as AspectRatio[];
  } catch { /* ignore */ }
  return [];
}

// localStorage に保存済み比率を書き込み
function saveSavedRatios(ratios: AspectRatio[]) {
  try {
    localStorage.setItem(SAVED_RATIOS_KEY, JSON.stringify(ratios));
  } catch { /* ignore */ }
}

interface AppState {
  images: ImageItem[];
  referenceImages: ReferenceImage[];
  ratios: AspectRatio[];
  activeRatioId: string;
  globalQuality: number;
  globalFormat: 'jpeg' | 'png' | 'webp';
  contextMenu: { x: number; y: number; imageId: string | null } | null;
  thumbnailSize: number; // px
  globalOutputLongEdge: number | null; // 書き出し時の長辺指定
  exportGroupName: string; // エクスポートグループ名
  // ファイル名構成設定
  nameElements: Array<'rename' | 'filename' | 'seq'>;
  nameSeparator: string;
  seqDigits: 2 | 3;

  // Actions
  addImages: (images: ImageItem[]) => void;
  removeImage: (id: string) => void;
  updateImage: (id: string, updates: Partial<ImageItem>) => void;
  addReferenceImage: (ref: ReferenceImage) => void;
  removeReferenceImage: (id: string) => void;
  addCustomRatio: (ratio: AspectRatio) => void;
  removeRatio: (id: string) => void;
  setActiveRatio: (id: string) => void;
  applyRatioToImage: (imageId: string, ratioId: string) => void;
  applyActiveRatioToSelected: () => void;
  applyActiveRatioToAll: () => void;
  setGlobalQuality: (quality: number) => void;
  setGlobalFormat: (format: 'jpeg' | 'png' | 'webp') => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectGroup: (group: string) => void;
  setContextMenu: (menu: { x: number; y: number; imageId: string | null } | null) => void;
  setThumbnailSize: (size: number) => void;
  setGlobalOutputLongEdge: (size: number | null) => void;
  setExportGroupName: (name: string) => void;
  moveImage: (fromIndex: number, toIndex: number) => void;
  swapActiveRatio: () => void;
  swapImageRatio: (imageId: string) => void;
  getActiveRatio: () => AspectRatio;
  getRatioById: (id: string) => AspectRatio | undefined;
  // トリミング解除
  resetCropToFull: (imageId: string) => void;
  resetCropSelected: () => void;
  resetCropAll: () => void;
  // 比率保存
  saveRatio: (id: string) => void;
  // 比率リネーム
  renameRatio: (id: string, newLabel: string) => void;
  // ファイル名構成設定
  setNameElements: (elements: Array<'rename' | 'filename' | 'seq'>) => void;
  setNameSeparator: (sep: string) => void;
  setSeqDigits: (digits: 2 | 3) => void;
  // 回転リセット
  resetCropRotation: (imageId: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  images: [],
  referenceImages: [],
  ratios: [...DEFAULT_RATIOS, ...loadSavedRatios()],
  activeRatioId: 'r-16-9',
  globalQuality: 90,
  globalFormat: 'jpeg',
  contextMenu: null,
  thumbnailSize: 240,
  globalOutputLongEdge: null,
  exportGroupName: '',
  nameElements: ['filename', 'seq'],
  nameSeparator: '_',
  seqDigits: 2,

  addImages: (newImages) =>
    set((state) => {
      const ratio = get().getActiveRatio();
      const mapped = newImages.map((img) => {
        const crop = calcCenteredCrop(img.width, img.height, ratio.width / ratio.height);
        return {
          ...img,
          displayName: img.originalName.replace(/\.[^.]+$/, ''),
          group: '',
          crop,
          ratioId: state.activeRatioId,
          cropRotation: 0,
          resize: null,
          quality: state.globalQuality,
          outputFormat: state.globalFormat,
          selected: false,
        };
      });
      return { images: [...state.images, ...mapped] };
    }),

  removeImage: (id) =>
    set((state) => {
      const img = state.images.find((i) => i.id === id);
      if (img) {
        // objectUrlを解放（元ファイルには影響なし）
        try { URL.revokeObjectURL(img.objectUrl); } catch { /* ignore */ }
      }
      return { images: state.images.filter((i) => i.id !== id) };
    }),

  updateImage: (id, updates) =>
    set((state) => ({
      images: state.images.map((img) =>
        img.id === id ? { ...img, ...updates } : img
      ),
    })),

  addReferenceImage: (ref) => {
    const gcd = calcGCD(ref.width, ref.height);
    const w = ref.width / gcd;
    const h = ref.height / gcd;
    const ratioId = `ref-${ref.id}`;
    const newRatio: AspectRatio = {
      id: ratioId,
      width: w,
      height: h,
      label: `${w}:${h} (参考)`,
      source: 'reference',
    };
    set((state) => ({
      referenceImages: [...state.referenceImages, ref],
      ratios: [...state.ratios, newRatio],
      activeRatioId: ratioId,
    }));
  },

  removeReferenceImage: (id) => {
    const ratioId = `ref-${id}`;
    const state = get();
    const ref = state.referenceImages.find((r) => r.id === id);
    if (ref) {
      try { URL.revokeObjectURL(ref.objectUrl); } catch { /* ignore */ }
    }
    set((s) => ({
      referenceImages: s.referenceImages.filter((r) => r.id !== id),
      ratios: s.ratios.filter((r) => r.id !== ratioId),
      activeRatioId: s.activeRatioId === ratioId ? 'r-16-9' : s.activeRatioId,
    }));
  },

  addCustomRatio: (ratio) =>
    set((state) => ({
      ratios: [...state.ratios, ratio],
      activeRatioId: ratio.id,
    })),

  removeRatio: (id) => {
    set((state) => {
      const newRatios = state.ratios.filter((r) => r.id !== id);
      saveSavedRatios(newRatios.filter((r) => r.source === 'saved'));
      return {
        ratios: newRatios,
        activeRatioId: state.activeRatioId === id ? 'r-16-9' : state.activeRatioId,
      };
    });
  },

  setActiveRatio: (id) => set({ activeRatioId: id }),

  applyRatioToImage: (imageId, ratioId) => {
    const ratio = get().getRatioById(ratioId);
    if (!ratio) return;
    set((state) => ({
      images: state.images.map((img) => {
        if (img.id !== imageId) return img;
        return {
          ...img,
          ratioId,
          crop: calcCenteredCrop(img.width, img.height, ratio.width / ratio.height),
          cropRotation: 0,
        };
      }),
    }));
  },

  applyActiveRatioToSelected: () => {
    const { activeRatioId } = get();
    const ratio = get().getActiveRatio();
    set((state) => ({
      images: state.images.map((img) => {
        if (!img.selected) return img;
        return {
          ...img,
          ratioId: activeRatioId,
          crop: calcCenteredCrop(img.width, img.height, ratio.width / ratio.height),
          cropRotation: 0,
        };
      }),
    }));
  },

  applyActiveRatioToAll: () => {
    const { activeRatioId } = get();
    const ratio = get().getActiveRatio();
    set((state) => ({
      images: state.images.map((img) => ({
        ...img,
        ratioId: activeRatioId,
        crop: calcCenteredCrop(img.width, img.height, ratio.width / ratio.height),
        cropRotation: 0,
      })),
    }));
  },

  setGlobalQuality: (quality) => {
    set({ globalQuality: quality });
    set((state) => ({
      images: state.images.map((img) => ({ ...img, quality })),
    }));
  },

  setGlobalFormat: (format) => {
    set({ globalFormat: format });
    set((state) => ({
      images: state.images.map((img) => ({ ...img, outputFormat: format })),
    }));
  },

  toggleSelect: (id) =>
    set((state) => ({
      images: state.images.map((img) =>
        img.id === id ? { ...img, selected: !img.selected } : img
      ),
    })),

  selectAll: () =>
    set((state) => ({
      images: state.images.map((img) => ({ ...img, selected: true })),
    })),

  deselectAll: () =>
    set((state) => ({
      images: state.images.map((img) => ({ ...img, selected: false })),
    })),

  selectGroup: (group) =>
    set((state) => ({
      images: state.images.map((img) => ({
        ...img,
        selected: img.group === group,
      })),
    })),

  setContextMenu: (menu) => set({ contextMenu: menu }),

  setThumbnailSize: (size) => set({ thumbnailSize: size }),

  setGlobalOutputLongEdge: (width) => set({ globalOutputLongEdge: width }),

  setExportGroupName: (name) => set({ exportGroupName: name }),

  moveImage: (fromIndex, toIndex) =>
    set((state) => {
      const imgs = [...state.images];
      const [moved] = imgs.splice(fromIndex, 1);
      imgs.splice(toIndex, 0, moved);
      return { images: imgs };
    }),

  swapActiveRatio: () => {
    const state = get();
    const current = state.ratios.find((r) => r.id === state.activeRatioId);
    if (!current || current.width === current.height) return;
    const swappedW = current.height;
    const swappedH = current.width;
    let existing = state.ratios.find((r) => r.width === swappedW && r.height === swappedH);
    if (!existing) {
      existing = {
        id: `swap-${swappedW}-${swappedH}-${Date.now()}`,
        width: swappedW,
        height: swappedH,
        label: `${swappedW}:${swappedH}`,
        source: 'custom',
      };
      set((s) => ({ ratios: [...s.ratios, existing!] }));
    }
    set({ activeRatioId: existing.id });
  },

  swapImageRatio: (imageId) => {
    const state = get();
    const img = state.images.find((i) => i.id === imageId);
    if (!img) return;
    const current = state.ratios.find((r) => r.id === img.ratioId);
    if (!current || current.width === current.height) return;
    const swappedW = current.height;
    const swappedH = current.width;
    let existing = state.ratios.find((r) => r.width === swappedW && r.height === swappedH);
    if (!existing) {
      existing = {
        id: `swap-${swappedW}-${swappedH}-${Date.now()}`,
        width: swappedW,
        height: swappedH,
        label: `${swappedW}:${swappedH}`,
        source: 'custom',
      };
      set((s) => ({ ratios: [...s.ratios, existing!] }));
    }
    const newRatio = swappedW / swappedH;
    const crop = calcCenteredCrop(img.width, img.height, newRatio);
    set((s) => ({
      images: s.images.map((i) =>
        i.id === imageId ? { ...i, crop, ratioId: existing!.id, cropRotation: 0 } : i
      ),
    }));
  },

  getActiveRatio: () => {
    const { ratios, activeRatioId } = get();
    return ratios.find((r) => r.id === activeRatioId) || DEFAULT_RATIOS[2];
  },

  getRatioById: (id) => {
    return get().ratios.find((r) => r.id === id);
  },

  // トリミング解除（画像全体にリセット）
  resetCropToFull: (imageId) => {
    set((state) => ({
      images: state.images.map((img) => {
        if (img.id !== imageId) return img;
        return {
          ...img,
          ratioId: 'free',
          crop: { x: 0, y: 0, width: img.width, height: img.height },
          cropRotation: 0,
        };
      }),
    }));
  },

  resetCropSelected: () => {
    set((state) => ({
      images: state.images.map((img) => {
        if (!img.selected) return img;
        return {
          ...img,
          ratioId: 'free',
          crop: { x: 0, y: 0, width: img.width, height: img.height },
          cropRotation: 0,
        };
      }),
    }));
  },

  resetCropAll: () => {
    set((state) => ({
      images: state.images.map((img) => ({
        ...img,
        ratioId: 'free',
        crop: { x: 0, y: 0, width: img.width, height: img.height },
        cropRotation: 0,
      })),
    }));
  },

  // 比率保存
  saveRatio: (id) => {
    set((state) => {
      const newRatios = state.ratios.map((r) =>
        r.id === id ? { ...r, source: 'saved' as const } : r
      );
      saveSavedRatios(newRatios.filter((r) => r.source === 'saved'));
      return { ratios: newRatios };
    });
  },

  // 比率リネーム
  renameRatio: (id, newLabel) => {
    set((state) => {
      const newRatios = state.ratios.map((r) =>
        r.id === id ? { ...r, label: newLabel } : r
      );
      saveSavedRatios(newRatios.filter((r) => r.source === 'saved'));
      return { ratios: newRatios };
    });
  },

  // ファイル名構成設定
  setNameElements: (elements) => set({ nameElements: elements }),
  setNameSeparator: (sep) => set({ nameSeparator: sep }),
  setSeqDigits: (digits) => set({ seqDigits: digits }),

  // 回転リセット
  resetCropRotation: (imageId) => {
    set((state) => ({
      images: state.images.map((img) =>
        img.id === imageId ? { ...img, cropRotation: 0 } : img
      ),
    }));
  },
}));

// ユーティリティ
export function calcGCD(a: number, b: number): number {
  a = Math.round(a);
  b = Math.round(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

export function calcCenteredCrop(
  imgW: number,
  imgH: number,
  targetRatio: number
): { x: number; y: number; width: number; height: number } {
  const imgRatio = imgW / imgH;
  let cropW: number, cropH: number;

  if (imgRatio > targetRatio) {
    cropH = imgH;
    cropW = Math.round(imgH * targetRatio);
  } else {
    cropW = imgW;
    cropH = Math.round(imgW / targetRatio);
  }

  cropW = Math.min(cropW, imgW);
  cropH = Math.min(cropH, imgH);

  return {
    x: Math.round((imgW - cropW) / 2),
    y: Math.round((imgH - cropH) / 2),
    width: cropW,
    height: cropH,
  };
}
