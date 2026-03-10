interface Props {
  onClose: () => void;
}

export function PrivacyDialog({ onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal legal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>プライバシー・セキュリティについて</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="legal-content">
          <section>
            <h3>🔒 画像はサーバーにアップロードされません</h3>
            <p>
              トリミンGooood!! では、お使いの画像は<strong>すべてブラウザ内（お使いのPC上）で処理</strong>されます。
              外部サーバーへの画像アップロードは一切行いません。
            </p>
          </section>

          <section>
            <h3>🖥️ クライアント完結型の仕組み</h3>
            <ul>
              <li><strong>画像の読み込み</strong>：ブラウザの File API を使用し、PC内のファイルを直接参照します</li>
              <li><strong>トリミング・回転・リサイズ</strong>：ブラウザの Canvas API でPC上で処理します</li>
              <li><strong>書き出し（ダウンロード）</strong>：処理後の画像はPCに直接ダウンロードされます</li>
            </ul>
          </section>

          <section>
            <h3>📡 通信について</h3>
            <ul>
              <li>画像データを含む通信は発生しません</li>
              <li>ユーザーの個人情報を収集・送信しません</li>
              <li>Cookie による追跡は行いません</li>
              <li>アクセス解析ツールは使用していません</li>
            </ul>
          </section>

          <section>
            <h3>💾 データの保存</h3>
            <ul>
              <li>読み込んだ画像はブラウザのメモリ上にのみ存在します</li>
              <li>ページを閉じると画像データは完全に消去されます</li>
              <li>アスペクト比の保存設定のみ localStorage を使用します（画像は含みません）</li>
            </ul>
          </section>

          <section>
            <h3>📝 元ファイルの安全性</h3>
            <p>
              元の画像ファイルは一切変更されません。
              トリミングや書き出しはすべて新しいファイルとして生成されます。
            </p>
          </section>

          <section>
            <h3>🔓 ソースコード</h3>
            <p>
              本ツールのソースコードは
              <a href="https://github.com/azamixx/trimingooood" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
              で公開されています。処理内容はどなたでも確認できます。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
