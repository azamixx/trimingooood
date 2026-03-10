import { useState, memo, useRef, useCallback, useEffect } from 'react';
import { useStore, calcCenteredCrop } from '../store';
import { getFullImageUrl } from '../api';
import type { ImageItem } from '../types';

type DragMode = 'none' | 'move' | 'resize' | 'rotate';

interface Props {
  image: ImageItem;
  index: number;
  isDragOver?: boolean;
  onReorderDragStart?: (index: number) => void;
  onReorderDragOver?: (index: number) => void;
  onReorderDrop?: (index: number) => void;
  onReorderDragEnd?: () => void;
}

export const ImageCard = memo(function ImageCard({ image, index, isDragOver, onReorderDragStart, onReorderDragOver, onReorderDrop, onReorderDragEnd }: Props) {
  const updateImage = useStore((s) => s.updateImage);
  const removeImage = useStore((s) => s.removeImage);
  const toggleSelect = useStore((s) => s.toggleSelect);
  const setContextMenu = useStore((s) => s.setContextMenu);
  const ratios = useStore((s) => s.ratios);
  const applyRatioToImage = useStore((s) => s.applyRatioToImage);
  const swapImageRatio = useStore((s) => s.swapImageRatio);
  const thumbnailSize = useStore((s) => s.thumbnailSize);
  const resetCropRotation = useStore((s) => s.resetCropRotation);

  const [editingName, setEditingName] = useState(false);
  const [editingGroup, setEditingGroup] = useState(false);
  const [nameValue, setNameValue] = useState(image.displayName);
  const [groupValue, setGroupValue] = useState(image.group);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [hoverZone, setHoverZone] = useState<DragMode>('none');
  const [cropOffset, setCropOffset] = useState({ x: image.crop.x, y: image.crop.y });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // ドラッグ開始時のスナップショット（再レンダ不要なのでref）
  const dragDataRef = useRef({
    startClientX: 0,
    startClientY: 0,
    startCropX: 0,
    startCropY: 0,
    startCropW: 0,
    startCropH: 0,
    startRotation: 0,
    startAngle: 0,
    startDist: 0,
  });

  const currentRatio = ratios.find((r) => r.id === image.ratioId);
  const cropRotation = image.cropRotation || 0;

  // 画像を読み込み
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = getFullImageUrl(image.objectUrl);
  }, [image.objectUrl]);

  // cropOffsetをimage.cropと同期
  useEffect(() => {
    setCropOffset({ x: image.crop.x, y: image.crop.y });
  }, [image.crop.x, image.crop.y]);

  // nameValue/groupValueをimageプロパティと同期
  useEffect(() => { setNameValue(image.displayName); }, [image.displayName]);
  useEffect(() => { setGroupValue(image.group); }, [image.group]);

  // ===== Canvas表示パラメータの計算ヘルパー =====
  const getDisplayParams = useCallback(() => {
    if (!canvasRef.current || !imgRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const displayW = rect.width;
    const displayH = rect.height;
    const img = imgRef.current;
    const scale = Math.min(displayW / img.naturalWidth, displayH / img.naturalHeight);
    const ox = (displayW - img.naturalWidth * scale) / 2;
    const oy = (displayH - img.naturalHeight * scale) / 2;
    return { rect, displayW, displayH, scale, ox, oy };
  }, []);

  // クロップ中心のクライアント座標
  const getCropCenterClient = useCallback(() => {
    const p = getDisplayParams();
    if (!p) return { x: 0, y: 0 };
    const cx = p.ox + (cropOffset.x + image.crop.width / 2) * p.scale;
    const cy = p.oy + (cropOffset.y + image.crop.height / 2) * p.scale;
    return { x: p.rect.left + cx, y: p.rect.top + cy };
  }, [getDisplayParams, cropOffset, image.crop.width, image.crop.height]);

  // ===== ヒットテスト: マウス位置からドラッグモードを判定 =====
  const getHitZone = useCallback((clientX: number, clientY: number): DragMode => {
    const p = getDisplayParams();
    if (!p) return 'none';

    const mx = clientX - p.rect.left;
    const my = clientY - p.rect.top;

    // クロップ枠の表示座標
    const cx = p.ox + cropOffset.x * p.scale;
    const cy = p.oy + cropOffset.y * p.scale;
    const cw = image.crop.width * p.scale;
    const ch = image.crop.height * p.scale;
    const ccx = cx + cw / 2;
    const ccy = cy + ch / 2;

    // ローカル座標系に変換（回転を打ち消す）
    const angleRad = -(cropRotation * Math.PI) / 180;
    const dx = mx - ccx;
    const dy = my - ccy;
    const localX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
    const localY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

    const hw = cw / 2;
    const hh = ch / 2;
    const edgeThreshold = 8;
    const rotateOuterRadius = 28; // 角の外側の回転ゾーン

    // 4隅の座標
    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ];

    // 角付近チェック → 回転
    for (const corner of corners) {
      const dist = Math.sqrt((localX - corner.x) ** 2 + (localY - corner.y) ** 2);
      if (dist < rotateOuterRadius) {
        // 枠の外側方向にいる場合に回転
        if (Math.abs(localX) > hw - 2 || Math.abs(localY) > hh - 2) {
          return 'rotate';
        }
      }
    }

    // 辺上チェック → リサイズ
    const nearLeft = Math.abs(localX + hw) < edgeThreshold;
    const nearRight = Math.abs(localX - hw) < edgeThreshold;
    const nearTop = Math.abs(localY + hh) < edgeThreshold;
    const nearBottom = Math.abs(localY - hh) < edgeThreshold;
    const withinX = localX >= -hw - edgeThreshold && localX <= hw + edgeThreshold;
    const withinY = localY >= -hh - edgeThreshold && localY <= hh + edgeThreshold;

    if (((nearLeft || nearRight) && withinY) || ((nearTop || nearBottom) && withinX)) {
      return 'resize';
    }

    // 内側チェック → 移動
    if (localX >= -hw && localX <= hw && localY >= -hh && localY <= hh) {
      return 'move';
    }

    return 'none';
  }, [getDisplayParams, cropOffset, image.crop.width, image.crop.height, cropRotation]);

  // ===== Canvas描画（回転対応 + ハンドル描画） =====
  const drawCanvas = useCallback(() => {
    if (!canvasRef.current || !imgRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const img = imgRef.current;

    const displayW = canvas.clientWidth;
    const displayH = canvas.clientHeight;
    if (displayW === 0 || displayH === 0) return;

    canvas.width = displayW * 2;
    canvas.height = displayH * 2;
    ctx.scale(2, 2);

    const scale = Math.min(displayW / img.naturalWidth, displayH / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const ox = (displayW - drawW) / 2;
    const oy = (displayH - drawH) / 2;

    // 画像全体（暗め）
    ctx.clearRect(0, 0, displayW, displayH);
    ctx.globalAlpha = 0.3;
    ctx.drawImage(img, ox, oy, drawW, drawH);
    ctx.globalAlpha = 1;

    // クロップ領域をクランプ
    const clampedX = Math.max(0, Math.min(cropOffset.x, image.width - image.crop.width));
    const clampedY = Math.max(0, Math.min(cropOffset.y, image.height - image.crop.height));
    const clampedW = Math.min(image.crop.width, image.width);
    const clampedH = Math.min(image.crop.height, image.height);

    const cx = ox + clampedX * scale;
    const cy = oy + clampedY * scale;
    const cw = clampedW * scale;
    const ch = clampedH * scale;

    const angleRad = (cropRotation * Math.PI) / 180;
    const cropCenterX = cx + cw / 2;
    const cropCenterY = cy + ch / 2;

    // 回転付きクロップ描画
    ctx.save();
    ctx.translate(cropCenterX, cropCenterY);
    ctx.rotate(angleRad);
    ctx.beginPath();
    ctx.rect(-cw / 2, -ch / 2, cw, ch);
    ctx.clip();
    ctx.rotate(-angleRad);
    ctx.translate(-cropCenterX, -cropCenterY);
    ctx.drawImage(img, ox, oy, drawW, drawH);
    ctx.restore();

    // 回転した枠線
    ctx.save();
    ctx.translate(cropCenterX, cropCenterY);
    ctx.rotate(angleRad);
    ctx.strokeStyle = 'rgba(233, 69, 96, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-cw / 2, -ch / 2, cw, ch);

    // 辺の中央にリサイズハンドル（小さい四角）
    const handleSize = 5;
    ctx.fillStyle = 'rgba(233, 69, 96, 0.9)';
    const midEdges = [
      { x: 0, y: -ch / 2 },     // 上辺中央
      { x: cw / 2, y: 0 },      // 右辺中央
      { x: 0, y: ch / 2 },      // 下辺中央
      { x: -cw / 2, y: 0 },     // 左辺中央
    ];
    for (const m of midEdges) {
      ctx.fillRect(m.x - handleSize, m.y - handleSize, handleSize * 2, handleSize * 2);
    }

    // 角に回転ハンドル（小さい丸）
    const cornerPositions = [
      { x: -cw / 2, y: -ch / 2 },
      { x: cw / 2, y: -ch / 2 },
      { x: cw / 2, y: ch / 2 },
      { x: -cw / 2, y: ch / 2 },
    ];
    ctx.fillStyle = 'rgba(233, 69, 96, 0.7)';
    for (const c of cornerPositions) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [cropOffset, image.crop.width, image.crop.height, image.width, image.height, cropRotation]);

  useEffect(() => {
    if (imgLoaded) drawCanvas();
  }, [imgLoaded, drawCanvas, thumbnailSize]);

  // Canvasサイズ変更時に再描画（ResizeObserver）
  useEffect(() => {
    if (!canvasRef.current || !imgLoaded) return;
    const observer = new ResizeObserver(() => drawCanvas());
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [imgLoaded, drawCanvas]);

  // ===== ドラッグでトリミング位置を変更 =====
  const getScaleFromCanvas = () => {
    if (!canvasRef.current || !imgRef.current) return 1;
    const displayW = canvasRef.current.clientWidth;
    const displayH = canvasRef.current.clientHeight;
    return Math.min(displayW / imgRef.current.width, displayH / imgRef.current.height);
  };

  // クロップサイズ変更の共通ロジック（リサイズドラッグ＆スライダー共用）
  const applyCropSize = useCallback((newWidth: number) => {
    const ratio = currentRatio ? currentRatio.width / currentRatio.height : image.crop.width / image.crop.height;

    let newW = Math.round(newWidth);
    let newH = Math.round(newW / ratio);

    if (newW > image.width) { newW = image.width; newH = Math.round(newW / ratio); }
    if (newH > image.height) { newH = image.height; newW = Math.round(newH * ratio); }

    newW = Math.min(newW, image.width);
    newH = Math.min(newH, image.height);
    if (newW < 20 || newH < 20) return;

    const cx = cropOffset.x + image.crop.width / 2;
    const cy = cropOffset.y + image.crop.height / 2;
    let newX = Math.round(cx - newW / 2);
    let newY = Math.round(cy - newH / 2);
    newX = Math.max(0, Math.min(newX, image.width - newW));
    newY = Math.max(0, Math.min(newY, image.height - newH));

    setCropOffset({ x: newX, y: newY });
    updateImage(image.id, {
      crop: { x: newX, y: newY, width: newW, height: newH },
    });
  }, [currentRatio, image, cropOffset, updateImage]);

  // ===== マウスイベントハンドラ =====
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const zone = getHitZone(e.clientX, e.clientY);
    if (zone === 'none') return;

    setDragMode(zone);

    const center = getCropCenterClient();
    const dx = e.clientX - center.x;
    const dy = e.clientY - center.y;

    dragDataRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCropX: cropOffset.x,
      startCropY: cropOffset.y,
      startCropW: image.crop.width,
      startCropH: image.crop.height,
      startRotation: cropRotation,
      startAngle: Math.atan2(dy, dx),
      startDist: Math.sqrt(dx * dx + dy * dy) || 1,
    };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragMode === 'none') return;

    if (dragMode === 'move') {
      const scale = getScaleFromCanvas();
      const dx = (e.clientX - dragDataRef.current.startClientX) / scale;
      const dy = (e.clientY - dragDataRef.current.startClientY) / scale;

      const newX = Math.max(0, Math.min(
        dragDataRef.current.startCropX + dx,
        image.width - image.crop.width
      ));
      const newY = Math.max(0, Math.min(
        dragDataRef.current.startCropY + dy,
        image.height - image.crop.height
      ));

      setCropOffset({ x: Math.round(newX), y: Math.round(newY) });

    } else if (dragMode === 'resize') {
      const center = getCropCenterClient();
      const dx = e.clientX - center.x;
      const dy = e.clientY - center.y;
      const currentDist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ratio = currentDist / dragDataRef.current.startDist;
      applyCropSize(dragDataRef.current.startCropW * ratio);

    } else if (dragMode === 'rotate') {
      const center = getCropCenterClient();
      const dx = e.clientX - center.x;
      const dy = e.clientY - center.y;
      const currentAngle = Math.atan2(dy, dx);
      const angleDelta = (currentAngle - dragDataRef.current.startAngle) * 180 / Math.PI;
      let newRotation = dragDataRef.current.startRotation + angleDelta;
      // 0°スナップ
      if (Math.abs(newRotation) < 1.5) newRotation = 0;
      // ±90°にクランプ
      newRotation = Math.max(-90, Math.min(90, newRotation));
      updateImage(image.id, { cropRotation: newRotation });
    }
  }, [dragMode, image.width, image.height, image.crop.width, image.crop.height, image.id, getCropCenterClient, applyCropSize, updateImage]);

  const handleMouseUp = useCallback(() => {
    if (dragMode === 'move') {
      updateImage(image.id, {
        crop: { ...image.crop, x: cropOffset.x, y: cropOffset.y },
      });
    }
    setDragMode('none');
  }, [dragMode, cropOffset, image.id, image.crop, updateImage]);

  useEffect(() => {
    if (dragMode !== 'none') {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragMode, handleMouseMove, handleMouseUp]);

  // ===== ホバー時のゾーン判定（カーソル変更用） =====
  const handleCanvasHover = (e: React.MouseEvent) => {
    if (dragMode !== 'none') return;
    setHoverZone(getHitZone(e.clientX, e.clientY));
  };

  const handleCanvasLeave = () => {
    if (dragMode === 'none') setHoverZone('none');
  };

  // 回転カーソル（SVGアイコン）
  const rotateCursorSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23e94560' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21.5 2v6h-6'/%3E%3Cpath d='M21.5 8A10 10 0 0 0 5.1 4.7'/%3E%3Cpath d='M2.5 22v-6h6'/%3E%3Cpath d='M2.5 16a10 10 0 0 0 16.4 3.3'/%3E%3C/svg%3E") 12 12, auto`;

  // カーソル決定
  const getCursor = () => {
    const mode = dragMode !== 'none' ? dragMode : hoverZone;
    switch (mode) {
      case 'move': return dragMode === 'move' ? 'grabbing' : 'grab';
      case 'resize': return 'nwse-resize';
      case 'rotate': return rotateCursorSvg;
      default: return 'default';
    }
  };

  // ===== スライダーでクロップサイズ変更 =====
  const handleZoomSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ratio = parseFloat(e.target.value);
    applyCropSize(image.width * ratio);
  };

  const zoomLevel = image.crop.width / image.width;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, imageId: image.id });
  };

  const commitName = () => { updateImage(image.id, { displayName: nameValue }); setEditingName(false); };
  const commitGroup = () => { updateImage(image.id, { group: groupValue }); setEditingGroup(false); };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const handleRatioChange = (ratioId: string) => {
    applyRatioToImage(image.id, ratioId);
  };

  const handleResetCrop = () => {
    const r = currentRatio || { width: image.crop.width, height: image.crop.height };
    const ratio = r.width / r.height;
    const crop = calcCenteredCrop(image.width, image.height, ratio);
    setCropOffset({ x: crop.x, y: crop.y });
    updateImage(image.id, { crop, cropRotation: 0 });
  };

  // 回転スライダー
  const handleRotationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseFloat(e.target.value);
    if (Math.abs(val) <= 1) val = 0;
    updateImage(image.id, { cropRotation: val });
  };

  return (
    <div
      className={`image-card ${image.selected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''}`}
      onContextMenu={handleContextMenu}
      onDragOver={(e) => { e.preventDefault(); onReorderDragOver?.(index); }}
      onDrop={(e) => { e.preventDefault(); onReorderDrop?.(index); }}
      style={{ width: thumbnailSize }}
    >
      <div className="card-checkbox">
        <input type="checkbox" checked={image.selected}
          onChange={() => toggleSelect(image.id)} />
      </div>
      <div
        className="card-canvas-wrap"
        style={{ height: thumbnailSize * 0.7 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleCanvasHover}
        onMouseLeave={handleCanvasLeave}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', cursor: getCursor() }}
        />
      </div>
      <div className="card-zoom-slider">
        <span className="zoom-icon">−</span>
        <input type="range" min="0.05" max="1" step="0.01"
          value={zoomLevel} onChange={handleZoomSlider} />
        <span className="zoom-icon">+</span>
      </div>
      {/* 回転スライダー */}
      <div className="card-rotation-slider">
        <span className="rotation-icon">↻</span>
        <input type="range" min="-90" max="90" step="0.5"
          value={cropRotation} onChange={handleRotationChange} />
        <span className="rotation-value">{cropRotation.toFixed(1)}°</span>
        {cropRotation !== 0 && (
          <button className="btn-icon btn-rotation-reset" onClick={() => resetCropRotation(image.id)} title="回転リセット">0°</button>
        )}
      </div>
      <div className="card-info">
        <div className="card-name">
          {editingName ? (
            <input autoFocus value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameValue(image.displayName); setEditingName(false); }}} />
          ) : (
            <span className="editable" onClick={() => setEditingName(true)} title="クリックでリネーム">
              {image.displayName}
            </span>
          )}
        </div>
        <div className="card-meta">
          <span>{image.crop.width}x{image.crop.height}</span>
          <span>{formatSize(image.size)}</span>
        </div>
        <div className="card-ratio-select">
          <select value={image.ratioId} onChange={(e) => handleRatioChange(e.target.value)}>
            <option value="free">フリー</option>
            {ratios.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <button className="btn-icon btn-swap-ratio" onClick={() => swapImageRatio(image.id)} title="縦横入れ替え">↔</button>
          <button className="btn-icon btn-reset" onClick={handleResetCrop} title="中央にリセット">↺</button>
        </div>
        <div className="card-group">
          {editingGroup ? (
            <input autoFocus value={groupValue} placeholder="グループ名"
              onChange={(e) => setGroupValue(e.target.value)}
              onBlur={commitGroup}
              onKeyDown={(e) => { if (e.key === 'Enter') commitGroup(); if (e.key === 'Escape') { setGroupValue(image.group); setEditingGroup(false); }}} />
          ) : (
            <span className="editable group-label" onClick={() => setEditingGroup(true)} title="クリックでグループ設定">
              {image.group || 'グループなし'}
            </span>
          )}
        </div>
      </div>
      {/* ドラッグハンドルに⠿マーク */}
      <div
        className="card-seq-badge"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          onReorderDragStart?.(index);
        }}
        onDragEnd={() => onReorderDragEnd?.()}
        title="ドラッグで並べ替え"
      ><span className="drag-handle-icon">⠿</span> {index + 1}</div>
      <button className="card-remove" onClick={(e) => { e.stopPropagation(); removeImage(image.id); }} title="リストから除外">×</button>
    </div>
  );
});
