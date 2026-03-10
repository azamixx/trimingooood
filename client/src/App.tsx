import { useEffect, useState } from 'react';
import { useStore } from './store';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { ContextMenu } from './components/ContextMenu';
import { ExportDialog } from './components/ExportDialog';
import './App.css';

export default function App() {
  const contextMenu = useStore((s) => s.contextMenu);
  const setContextMenu = useStore((s) => s.setContextMenu);
  const [showExport, setShowExport] = useState(false);
  const [exportMode, setExportMode] = useState<'all' | 'selected' | 'group'>('all');
  const [exportGroup, setExportGroup] = useState('');

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [setContextMenu]);

  const handleExport = (mode: 'all' | 'selected' | 'group', group?: string) => {
    setExportMode(mode);
    setExportGroup(group || '');
    setShowExport(true);
    setContextMenu(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>トリミンGooood!!</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => handleExport('all')}>
            すべて書き出し
          </button>
        </div>
      </header>
      <main className="app-main">
        <LeftPanel />
        <RightPanel onExport={handleExport} />
      </main>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          imageId={contextMenu.imageId}
          onExport={handleExport}
        />
      )}
      {showExport && (
        <ExportDialog
          mode={exportMode}
          group={exportGroup}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
