import { useState } from 'react';
import { useStore } from '../store';
import { processImage } from '../lib/imageProcessor';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

type NameElementType = 'rename' | 'filename' | 'seq';

const ELEMENT_LABELS: Record<NameElementType, string> = {
  rename: 'リネーム名',
  filename: 'ファイル名',
  seq: '連番',
};

interface Props {
  mode: 'all' | 'selected' | 'group';
  group: string;
  onClose: () => void;
}

export function ExportDialog({ mode, group, onClose }: Props) {
  const images = useStore((s) => s.images);
  const globalOutputLongEdge = useStore((s) => s.globalOutputLongEdge);
  const exportGroupName = useStore((s) => s.exportGroupName);
  const setExportGroupName = useStore((s) => s.setExportGroupName);
  const nameElements = useStore((s) => s.nameElements);
  const setNameElements = useStore((s) => s.setNameElements);
  const nameSeparator = useStore((s) => s.nameSeparator);
  const setNameSeparator = useStore((s) => s.setNameSeparator);
  const seqDigits = useStore((s) => s.seqDigits);
  const setSeqDigits = useStore((s) => s.setSeqDigits);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // 書き出し対象
  let targets = images;
  if (mode === 'selected') {
    targets = images.filter((i) => i.selected);
    if (targets.length === 0) {
      targets = images.slice(0, 1); // fallback
    }
  } else if (mode === 'group') {
    targets = images.filter((i) => i.group === group);
  }

  // 利用可能な（未使用の）要素
  const allElementTypes: NameElementType[] = ['rename', 'filename', 'seq'];
  const unusedElements = allElementTypes.filter((t) => !nameElements.includes(t));

  // 要素を削除
  const removeElement = (index: number) => {
    setNameElements(nameElements.filter((_, i) => i !== index));
  };

  // 要素を追加
  const addElement = (type: NameElementType) => {
    setNameElements([...nameElements, type]);
  };

  // ドラッグ並べ替え
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (index: number) => {
    setDragOverIndex(index);
  };

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newElements = [...nameElements];
    const [moved] = newElements.splice(dragIndex, 1);
    newElements.splice(targetIndex, 0, moved);
    setNameElements(newElements);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // outputNameを構成
  const buildOutputName = (img: typeof targets[0], index: number) => {
    const parts: string[] = [];
    for (const el of nameElements) {
      switch (el) {
        case 'rename':
          if (exportGroupName) parts.push(exportGroupName);
          break;
        case 'filename':
          parts.push(img.displayName);
          break;
        case 'seq':
          parts.push(String(index + 1).padStart(seqDigits, '0'));
          break;
      }
    }
    if (parts.length === 0) {
      parts.push(img.id.slice(0, 8)); // fallback
    }
    return parts.join(nameSeparator);
  };

  // パターンプレビュー
  const buildPatternPreview = () => {
    const parts: string[] = [];
    for (const el of nameElements) {
      switch (el) {
        case 'rename':
          parts.push(exportGroupName || 'リネーム名');
          break;
        case 'filename':
          parts.push('ファイル名');
          break;
        case 'seq':
          parts.push(seqDigits === 2 ? '01' : '001');
          break;
      }
    }
    return parts.join(nameSeparator) || '(空)';
  };

  // resize を計算: globalOutputLongEdge があれば長辺に適用
  const buildResize = (img: typeof targets[0]) => {
    if (!globalOutputLongEdge) return img.resize;
    const cropW = img.crop.width;
    const cropH = img.crop.height;
    if (cropW >= cropH) {
      return {
        width: globalOutputLongEdge,
        height: Math.round(globalOutputLongEdge * (cropH / cropW)),
      };
    } else {
      return {
        width: Math.round(globalOutputLongEdge * (cropW / cropH)),
        height: globalOutputLongEdge,
      };
    }
  };

  // クライアント完結: Canvas API + JSZip で書き出し
  const handleExport = async () => {
    setExporting(true);
    setProgress(0);
    setResult(null);

    try {
      if (targets.length === 1) {
        // 1枚の場合: 直接ダウンロード
        const img = targets[0];
        const resize = buildResize(img);
        const blob = await processImage(img.objectUrl, img.crop, {
          cropRotation: img.cropRotation || 0,
          resize,
          quality: img.quality,
          format: img.outputFormat,
        });
        const ext = img.outputFormat === 'jpeg' ? '.jpg' : `.${img.outputFormat}`;
        const outName = buildOutputName(img, 0);
        saveAs(blob, `${outName}${ext}`);
        setProgress(100);
        setResult('1件の画像をダウンロードしました');
      } else {
        // 複数の場合: ZIPにまとめてダウンロード
        const zip = new JSZip();
        let processed = 0;

        for (let i = 0; i < targets.length; i++) {
          const img = targets[i];
          const resize = buildResize(img);
          const blob = await processImage(img.objectUrl, img.crop, {
            cropRotation: img.cropRotation || 0,
            resize,
            quality: img.quality,
            format: img.outputFormat,
          });
          const ext = img.outputFormat === 'jpeg' ? '.jpg' : `.${img.outputFormat}`;
          const outName = buildOutputName(img, i);

          // グループフォルダ分け
          const path = img.group
            ? `${img.group}/${outName}${ext}`
            : `${outName}${ext}`;

          zip.file(path, blob);
          processed++;
          setProgress(Math.round((processed / targets.length) * 90));
        }

        setProgress(95);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipName = exportGroupName
          ? `${exportGroupName}.zip`
          : 'trimmin-gooood-export.zip';
        saveAs(zipBlob, zipName);
        setProgress(100);
        setResult(`${targets.length}件の画像をZIPでダウンロードしました`);
      }
    } catch (err) {
      console.error('書き出しエラー:', err);
      setResult('書き出しに失敗しました');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>書き出し</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="export-content">
          <div className="export-summary">
            <p>
              {mode === 'all' && `全${targets.length}件を書き出します`}
              {mode === 'selected' && `選択中の${targets.length}件を書き出します`}
              {mode === 'group' &&
                `グループ「${group}」の${targets.length}件を書き出します`}
            </p>
            <p className="export-note">
              ※ 画像はブラウザ内で処理されます。サーバーへのアップロードは行いません。
            </p>
          </div>

          {/* ファイル名構成 */}
          <div className="name-composer">
            <label>ファイル名構成:</label>
            <div className="name-elements-row">
              {nameElements.map((el, i) => (
                <div key={`${el}-${i}`} className="name-element-group">
                  {i > 0 && (
                    <input
                      className="name-separator-input"
                      type="text"
                      value={nameSeparator}
                      onChange={(e) => setNameSeparator(e.target.value)}
                      maxLength={5}
                      title="区切り文字を編集"
                    />
                  )}
                  <div
                    className={`name-element-chip ${dragOverIndex === i ? 'drag-over' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={(e) => { e.preventDefault(); handleDragOver(i); }}
                    onDrop={() => handleDrop(i)}
                    onDragEnd={handleDragEnd}
                  >
                    <button
                      className="name-element-remove"
                      onClick={() => removeElement(i)}
                      title="この要素を除外"
                    >×</button>
                    <span className="name-element-label">{ELEMENT_LABELS[el]}</span>
                    {el === 'rename' && (
                      <input
                        className="name-element-value"
                        type="text"
                        value={exportGroupName}
                        onChange={(e) => setExportGroupName(e.target.value)}
                        placeholder="名前を入力"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    )}
                    {el === 'seq' && (
                      <select
                        className="name-element-config"
                        value={seqDigits}
                        onChange={(e) => setSeqDigits(parseInt(e.target.value) as 2 | 3)}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <option value={2}>2桁</option>
                        <option value={3}>3桁</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
              {nameElements.length === 0 && (
                <span className="name-empty-hint">要素を追加してください</span>
              )}
            </div>
            {unusedElements.length > 0 && (
              <div className="name-add-elements">
                {unusedElements.map((type) => (
                  <button
                    key={type}
                    className="btn btn-tiny name-add-btn"
                    onClick={() => addElement(type)}
                  >
                    + {ELEMENT_LABELS[type]}
                  </button>
                ))}
              </div>
            )}
            <div className="name-preview">
              プレビュー: <code>{buildPatternPreview()}.jpg</code>
            </div>
          </div>

          <div className="export-targets">
            <h3>書き出し対象:</h3>
            <div className="export-list">
              {targets.map((img, i) => {
                const resize = buildResize(img);
                const outName = buildOutputName(img, i);
                const ext = img.outputFormat === 'jpeg' ? '.jpg' : `.${img.outputFormat}`;
                return (
                  <div key={img.id} className="export-item">
                    <span className="export-name">{outName}{ext}</span>
                    <span className="export-detail">
                      {Math.round(img.crop.width)}x{Math.round(img.crop.height)}
                      {resize && ` → ${resize.width}x${resize.height}`}
                      {' '}| {img.outputFormat.toUpperCase()} {img.quality}%
                      {(img.cropRotation || 0) !== 0 && ` | ↻${img.cropRotation.toFixed(1)}°`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {exporting && (
            <div className="export-progress">
              <div className="export-progress-bar">
                <div className="export-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="export-progress-text">{progress}%</span>
            </div>
          )}

          {result && <div className="export-result">{result}</div>}
          <div className="export-actions">
            <button className="btn" onClick={onClose}>
              閉じる
            </button>
            <button
              className="btn btn-primary"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? '処理中...' : targets.length === 1 ? 'ダウンロード' : 'ZIPダウンロード'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
