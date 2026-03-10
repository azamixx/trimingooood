import { useCallback, useRef, useState } from 'react';
import { useStore, calcGCD } from '../store';
import { loadReferenceImage } from '../lib/imageProcessor';

// DPIスナップポイント
const SNAP_POINTS = [
  { value: 24, dpi: 72 },
  { value: 50, dpi: 150 },
  { value: 100, dpi: 300 },
];

function snapQuality(raw: number): number {
  for (const sp of SNAP_POINTS) {
    if (Math.abs(raw - sp.value) <= 2) return sp.value;
  }
  return raw;
}

export function LeftPanel() {
  const referenceImages = useStore((s) => s.referenceImages);
  const addReferenceImage = useStore((s) => s.addReferenceImage);
  const removeReferenceImage = useStore((s) => s.removeReferenceImage);
  const ratios = useStore((s) => s.ratios);
  const activeRatioId = useStore((s) => s.activeRatioId);
  const setActiveRatio = useStore((s) => s.setActiveRatio);
  const addCustomRatio = useStore((s) => s.addCustomRatio);
  const removeRatio = useStore((s) => s.removeRatio);
  const applyActiveRatioToSelected = useStore((s) => s.applyActiveRatioToSelected);
  const applyActiveRatioToAll = useStore((s) => s.applyActiveRatioToAll);
  const swapActiveRatio = useStore((s) => s.swapActiveRatio);
  const globalQuality = useStore((s) => s.globalQuality);
  const setGlobalQuality = useStore((s) => s.setGlobalQuality);
  const globalFormat = useStore((s) => s.globalFormat);
  const setGlobalFormat = useStore((s) => s.setGlobalFormat);
  const thumbnailSize = useStore((s) => s.thumbnailSize);
  const setThumbnailSize = useStore((s) => s.setThumbnailSize);
  const globalOutputLongEdge = useStore((s) => s.globalOutputLongEdge);
  const setGlobalOutputLongEdge = useStore((s) => s.setGlobalOutputLongEdge);
  const images = useStore((s) => s.images);
  // 機能1: トリミング解除
  const resetCropSelected = useStore((s) => s.resetCropSelected);
  const resetCropAll = useStore((s) => s.resetCropAll);
  // 機能3: 比率保存
  const saveRatio = useStore((s) => s.saveRatio);
  // 機能4: 比率リネーム
  const renameRatio = useStore((s) => s.renameRatio);
  const [manualW, setManualW] = useState('16');
  const [manualH, setManualH] = useState('9');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 機能4: リネーム編集中のID
  const [editingRatioId, setEditingRatioId] = useState<string | null>(null);
  const [editingRatioLabel, setEditingRatioLabel] = useState('');

  const handleRefUpload = useCallback(
    async (file: File) => {
      const data = await loadReferenceImage(file);
      addReferenceImage(data);
    },
    [addReferenceImage]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) handleRefUpload(file);
    },
    [handleRefUpload]
  );

  const handleAddCustomRatio = () => {
    const w = parseInt(manualW) || 1;
    const h = parseInt(manualH) || 1;
    const gcd = calcGCD(w, h);
    const sw = w / gcd;
    const sh = h / gcd;
    const id = `custom-${sw}-${sh}-${Date.now()}`;
    addCustomRatio({ id, width: sw, height: sh, label: `${sw}:${sh}`, source: 'custom' });
  };

  const selectedCount = images.filter((i) => i.selected).length;

  const handleCleanup = () => {
    // クライアント完結: objectUrlを全解放してリロード
    window.location.reload();
  };

  // 機能4: リネーム確定
  const commitRatioRename = () => {
    if (editingRatioId && editingRatioLabel.trim()) {
      renameRatio(editingRatioId, editingRatioLabel.trim());
    }
    setEditingRatioId(null);
  };

  // 機能6: 品質スライダーのDPI参考値
  const qualityDpi = globalQuality * 3;

  return (
    <aside className="left-panel">
      <section className="panel-section">
        <h2>参考画像</h2>
        <div
          className={`drop-zone ref-drop ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="drop-placeholder">
            <span>ドラッグ＆ドロップ</span>
            <span className="drop-sub">参考画像を追加（複数可）</span>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRefUpload(f); e.target.value = ''; }} />
        </div>
        {referenceImages.length > 0 && (
          <div className="ref-list">
            {referenceImages.map((ref) => (
              <div key={ref.id} className="ref-item">
                <img src={ref.objectUrl} alt="ref" className="ref-thumb" />
                <div className="ref-meta">
                  <span className="ref-size">{ref.width}x{ref.height}</span>
                  <button
                    className={`btn btn-tiny ${activeRatioId === `ref-${ref.id}` ? 'active' : ''}`}
                    onClick={() => setActiveRatio(`ref-${ref.id}`)}
                  >使用</button>
                </div>
                <button className="btn-icon" onClick={() => removeReferenceImage(ref.id)}>×</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel-section">
        <h2>アスペクト比</h2>
        <div className="ratio-list">
          {ratios.map((r) => (
            <div key={r.id} className={`ratio-chip ${activeRatioId === r.id ? 'active' : ''}`}>
              {editingRatioId === r.id ? (
                <input
                  className="ratio-chip-edit"
                  autoFocus
                  value={editingRatioLabel}
                  onChange={(e) => setEditingRatioLabel(e.target.value)}
                  onBlur={commitRatioRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRatioRename();
                    if (e.key === 'Escape') setEditingRatioId(null);
                  }}
                />
              ) : (
                <button
                  className="ratio-chip-btn"
                  onClick={() => setActiveRatio(r.id)}
                  onDoubleClick={() => {
                    if (r.source !== 'preset') {
                      setEditingRatioId(r.id);
                      setEditingRatioLabel(r.label);
                    }
                  }}
                  title={r.source !== 'preset' ? 'ダブルクリックでリネーム' : undefined}
                >
                  {r.source === 'saved' && '💾 '}{r.label}
                </button>
              )}
              {r.source === 'custom' && (
                <button className="ratio-chip-save" onClick={() => saveRatio(r.id)} title="この比率を保存">💾</button>
              )}
              {r.source !== 'preset' && (
                <button className="ratio-chip-remove" onClick={() => removeRatio(r.id)}>×</button>
              )}
            </div>
          ))}
        </div>
        <button className="btn btn-small btn-swap" onClick={swapActiveRatio} title="縦横入れ替え">
          ↔ 縦横入れ替え
        </button>
        <div className="ratio-manual">
          <input type="number" min="1" value={manualW} onChange={(e) => setManualW(e.target.value)} />
          <span>:</span>
          <input type="number" min="1" value={manualH} onChange={(e) => setManualH(e.target.value)} />
          <button className="btn btn-small" onClick={handleAddCustomRatio}>追加</button>
        </div>
        {images.length > 0 && (
          <div className="ratio-apply-buttons">
            <button className="btn btn-small" onClick={applyActiveRatioToAll}>
              すべてに適用
            </button>
            {selectedCount > 0 && (
              <button className="btn btn-small" onClick={applyActiveRatioToSelected}>
                選択中({selectedCount})に適用
              </button>
            )}
          </div>
        )}
        {/* 機能1: トリミング解除 */}
        {images.length > 0 && (
          <div className="ratio-apply-buttons" style={{ marginTop: 4 }}>
            <button className="btn btn-small" onClick={resetCropAll}>
              トリミング解除（全て）
            </button>
            {selectedCount > 0 && (
              <button className="btn btn-small" onClick={resetCropSelected}>
                トリミング解除（{selectedCount}枚）
              </button>
            )}
          </div>
        )}
      </section>

      <section className="panel-section">
        <h2>表示サイズ</h2>
        <label className="setting-row">
          <span>{thumbnailSize}px</span>
          {/* 表示サイズスライダー */}
          <input type="range" min="120" max="1600" value={thumbnailSize}
            onChange={(e) => setThumbnailSize(parseInt(e.target.value))} />
        </label>
      </section>

      <section className="panel-section">
        <h2>書き出し設定</h2>
        <label className="setting-row">
          <span>長辺 (px)</span>
          <div className="output-size-row">
            <input type="number" min="1" placeholder="元のまま"
              value={globalOutputLongEdge ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                setGlobalOutputLongEdge(v ? parseInt(v) || null : null);
              }}
            />
            <button className="btn btn-tiny" onClick={() => setGlobalOutputLongEdge(null)}>リセット</button>
          </div>
          {globalOutputLongEdge && (
            <span className="output-size-hint">短辺はアスペクト比から自動計算</span>
          )}
        </label>
        <label className="setting-row">
          <span>フォーマット</span>
          <select value={globalFormat}
            onChange={(e) => setGlobalFormat(e.target.value as 'jpeg' | 'png' | 'webp')}>
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
          </select>
        </label>
        {/* 機能6: 品質スライダー + DPI参考値 + スナップ */}
        <label className="setting-row">
          <span>品質: {globalQuality}% ({qualityDpi}dpi)</span>
          <div className="quality-slider-wrap">
            <input type="range" min="10" max="100" value={globalQuality}
              onChange={(e) => setGlobalQuality(snapQuality(parseInt(e.target.value)))} />
            <div className="quality-snap-markers">
              {SNAP_POINTS.map((sp) => (
                <div
                  key={sp.value}
                  className="snap-marker"
                  style={{ left: `${((sp.value - 10) / 90) * 100}%` }}
                  title={`${sp.dpi}dpi`}
                >
                  <div className="snap-dot" />
                  <span className="snap-label">{sp.dpi}dpi</span>
                </div>
              ))}
            </div>
          </div>
        </label>
      </section>

      <section className="panel-section">
        <button className="btn btn-small btn-danger" style={{ width: '100%' }} onClick={handleCleanup}>
          一時ファイルをクリア
        </button>
      </section>
    </aside>
  );
}
