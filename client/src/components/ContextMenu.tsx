import { useStore } from '../store';

interface Props {
  x: number;
  y: number;
  imageId: string | null;
  onExport: (mode: 'all' | 'selected' | 'group', group?: string) => void;
}

export function ContextMenu({ x, y, imageId, onExport }: Props) {
  const images = useStore((s) => s.images);
  const removeImage = useStore((s) => s.removeImage);
  const toggleSelect = useStore((s) => s.toggleSelect);
  const selectGroup = useStore((s) => s.selectGroup);
  const setContextMenu = useStore((s) => s.setContextMenu);

  const image = imageId ? images.find((i) => i.id === imageId) : null;
  const selectedCount = images.filter((i) => i.selected).length;
  const groups = [...new Set(images.map((i) => i.group).filter(Boolean))];

  const close = () => setContextMenu(null);

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: y,
    left: x,
    zIndex: 1000,
  };

  return (
    <div className="context-menu" style={menuStyle} onClick={(e) => e.stopPropagation()}>
      {image && (
        <>
          <button className="ctx-item" onClick={() => { toggleSelect(image.id); close(); }}>
            {image.selected ? '選択解除' : '選択'}
          </button>
          <button className="ctx-item" onClick={() => { toggleSelect(image.id); onExport('selected'); }}>
            この画像を書き出し
          </button>
          {image.group && (
            <>
              <div className="ctx-divider" />
              <button className="ctx-item" onClick={() => { selectGroup(image.group); close(); }}>
                グループ「{image.group}」を全選択
              </button>
              <button className="ctx-item" onClick={() => onExport('group', image.group)}>
                グループ「{image.group}」を書き出し
              </button>
            </>
          )}
          <div className="ctx-divider" />
          <button className="ctx-item ctx-danger" onClick={() => { removeImage(image.id); close(); }}>
            リストから除外
          </button>
        </>
      )}
      {!image && (
        <>
          {selectedCount > 0 && (
            <button className="ctx-item" onClick={() => onExport('selected')}>
              選択中({selectedCount})を書き出し
            </button>
          )}
          {groups.map((g) => (
            <button key={g} className="ctx-item" onClick={() => onExport('group', g)}>
              グループ「{g}」を書き出し
            </button>
          ))}
          <button className="ctx-item" onClick={() => onExport('all')}>
            すべて書き出し
          </button>
        </>
      )}
    </div>
  );
}
