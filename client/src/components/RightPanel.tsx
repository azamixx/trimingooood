import { useCallback, useRef, useState } from 'react';
import { useStore } from '../store';
import { loadImageFromFile } from '../lib/imageProcessor';
import { ImageCard } from './ImageCard';

interface Props {
  onExport: (mode: 'all' | 'selected' | 'group', group?: string) => void;
}

export function RightPanel({ onExport }: Props) {
  const images = useStore((s) => s.images);
  const addImages = useStore((s) => s.addImages);
  const moveImage = useStore((s) => s.moveImage);
  const selectAll = useStore((s) => s.selectAll);
  const deselectAll = useStore((s) => s.deselectAll);
  const thumbnailSize = useStore((s) => s.thumbnailSize);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // カード並べ替え用
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const selectedCount = images.filter((i) => i.selected).length;
  const groups = [...new Set(images.map((i) => i.group).filter(Boolean))];

  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith('image/') || /\.(heic|heif|tiff?)$/i.test(f.name)
      );
      if (imageFiles.length === 0) return;
      setUploading(true);
      try {
        // クライアント側で完結: File API → objectUrl + メタデータ取得
        const loaded = await Promise.all(
          imageFiles.map((f) => loadImageFromFile(f).catch((err) => {
            console.warn(`スキップ: ${f.name}`, err);
            return null;
          }))
        );
        const valid = loaded.filter((r): r is NonNullable<typeof r> => r !== null);
        if (valid.length > 0) {
          addImages(valid.map((r) => ({
            id: r.id,
            originalName: r.originalName,
            objectUrl: r.objectUrl,
            width: r.width,
            height: r.height,
            size: r.size,
            format: r.format,
            displayName: '',
            group: '',
            crop: { x: 0, y: 0, width: r.width, height: r.height },
            ratioId: 'free',
            cropRotation: 0,
            resize: null,
            quality: 90,
            outputFormat: 'jpeg',
            selected: false,
          })));
        }
      } catch (err) {
        console.error('画像読み込み失敗:', err);
      } finally {
        setUploading(false);
      }
    },
    [addImages]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      // カード並べ替え中はファイルアップロードしない
      if (dragFromIndex !== null) return;
      handleUpload(e.dataTransfer.files);
    },
    [handleUpload, dragFromIndex]
  );

  const handleCardDragStart = useCallback((index: number) => {
    setDragFromIndex(index);
  }, []);

  const handleCardDragOver = useCallback((index: number) => {
    setDragOverIndex(index);
  }, []);

  const handleCardDrop = useCallback((toIndex: number) => {
    if (dragFromIndex !== null && dragFromIndex !== toIndex) {
      moveImage(dragFromIndex, toIndex);
    }
    setDragFromIndex(null);
    setDragOverIndex(null);
  }, [dragFromIndex, moveImage]);

  const handleCardDragEnd = useCallback(() => {
    setDragFromIndex(null);
    setDragOverIndex(null);
  }, []);

  return (
    <div
      className="right-panel"
      onDragOver={(e) => { e.preventDefault(); if (dragFromIndex === null) setIsDragging(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setIsDragging(false); }}
      onDrop={handleDrop}
    >
      <div className="right-toolbar">
        <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? '読み込み中...' : '画像を追加'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => { if (e.target.files) handleUpload(e.target.files); e.target.value = ''; }} />
        {images.length > 0 && (
          <>
            <button className="btn" onClick={selectAll}>全選択</button>
            <button className="btn" onClick={deselectAll}>選択解除</button>
            {selectedCount > 0 && (
              <button className="btn btn-primary" onClick={() => onExport('selected')}>
                選択中({selectedCount})を書き出し
              </button>
            )}
          </>
        )}
        {groups.length > 0 && (
          <select className="group-filter" onChange={(e) => { if (e.target.value) onExport('group', e.target.value); }} value="">
            <option value="">グループ書き出し...</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        {images.length > 0 && (
          <span className="toolbar-info">{images.length}枚 | 番号ドラッグで並べ替え / 枠ドラッグで移動・リサイズ・回転</span>
        )}
      </div>

      {images.length === 0 ? (
        <div className={`drop-zone main-drop ${isDragging ? 'dragging' : ''}`}
          onClick={() => fileInputRef.current?.click()}>
          <div className="drop-placeholder">
            <span className="drop-icon">+</span>
            <span>画像をドラッグ＆ドロップ</span>
            <span className="drop-sub">またはクリックで追加</span>
          </div>
        </div>
      ) : (
        <>
          {isDragging && dragFromIndex === null && (
            <div className="drop-overlay"><span>ここにドロップして追加</span></div>
          )}
          <div className="image-grid" style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))`,
          }}>
            {images.map((img, index) => (
              <ImageCard
                key={img.id}
                image={img}
                index={index}
                isDragOver={dragOverIndex === index && dragFromIndex !== index}
                onReorderDragStart={handleCardDragStart}
                onReorderDragOver={handleCardDragOver}
                onReorderDrop={handleCardDrop}
                onReorderDragEnd={handleCardDragEnd}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
