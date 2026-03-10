import { useEffect, useState } from 'react';
import { useStore } from './store';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { ContextMenu } from './components/ContextMenu';
import { ExportDialog } from './components/ExportDialog';
import { PrivacyDialog } from './components/PrivacyDialog';
import { TermsDialog } from './components/TermsDialog';
import './App.css';

export default function App() {
  const contextMenu = useStore((s) => s.contextMenu);
  const setContextMenu = useStore((s) => s.setContextMenu);
  const [showExport, setShowExport] = useState(false);
  const [exportMode, setExportMode] = useState<'all' | 'selected' | 'group'>('all');
  const [exportGroup, setExportGroup] = useState('');
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

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
      <footer className="app-footer">
        <span className="footer-security">🔒 画像はサーバーに送信されません（ブラウザ内で完結）</span>
        <nav className="footer-links">
          <button className="footer-link" onClick={() => setShowPrivacy(true)}>
            プライバシー・セキュリティ
          </button>
          <span className="footer-sep">|</span>
          <button className="footer-link" onClick={() => setShowTerms(true)}>
            利用規約
          </button>
        </nav>
      </footer>
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
      {showPrivacy && <PrivacyDialog onClose={() => setShowPrivacy(false)} />}
      {showTerms && <TermsDialog onClose={() => setShowTerms(false)} />}
    </div>
  );
}
