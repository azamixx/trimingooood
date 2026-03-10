interface Props {
  onClose: () => void;
}

export function TermsDialog({ onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal legal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>利用規約</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="legal-content">
          <p className="legal-updated">最終更新日: 2026年3月10日</p>

          <section>
            <h3>第1条（サービスの概要）</h3>
            <p>
              トリミンGooood!!（以下「本ツール」）は、ブラウザ上で動作する画像トリミングツールです。
              本ツールは無料で提供され、どなたでもご利用いただけます。
            </p>
          </section>

          <section>
            <h3>第2条（利用条件）</h3>
            <ul>
              <li>本ツールの利用にアカウント登録は不要です</li>
              <li>本ツールは個人利用・商用利用を問わずご利用いただけます</li>
              <li>本ツールを利用することにより、本規約に同意したものとみなします</li>
            </ul>
          </section>

          <section>
            <h3>第3条（免責事項）</h3>
            <ul>
              <li>
                本ツールは「現状有姿（AS IS）」で提供されます。
                運営者は、本ツールの動作、正確性、信頼性、完全性、安全性について、
                明示的にも黙示的にも一切の保証を行いません。
              </li>
              <li>
                本ツールの利用または利用不能により生じたいかなる損害（データの消失、
                画像の品質劣化、業務上の損失等を含みますがこれに限りません）について、
                運営者は一切の責任を負いません。
              </li>
              <li>
                本ツールの利用により第三者との間で紛争が生じた場合、
                利用者は自己の費用と責任で解決するものとし、
                運営者は一切の責任を負いません。
              </li>
            </ul>
          </section>

          <section>
            <h3>第4条（画像データの取り扱い）</h3>
            <ul>
              <li>本ツールは画像データを外部サーバーに送信しません</li>
              <li>すべての画像処理はお使いのブラウザ内で完結します</li>
              <li>運営者は利用者の画像データにアクセスできません</li>
              <li>利用者は、自身が権利を有する画像、または使用許諾を得た画像のみを処理してください</li>
            </ul>
          </section>

          <section>
            <h3>第5条（禁止事項）</h3>
            <p>以下の行為を禁止します：</p>
            <ul>
              <li>本ツールを悪用し、第三者の権利を侵害する行為</li>
              <li>本ツールの運営を妨害する行為</li>
              <li>本ツールを改変して不正に再配布する行為</li>
            </ul>
          </section>

          <section>
            <h3>第6条（サービスの変更・停止）</h3>
            <p>
              運営者は、事前の通知なく本ツールの内容変更、提供の中断・終了を行うことができます。
              これにより利用者に生じた損害について、運営者は一切の責任を負いません。
            </p>
          </section>

          <section>
            <h3>第7条（規約の変更）</h3>
            <p>
              運営者は、本規約を随時変更できるものとします。
              変更後の規約は本ページに掲載した時点で効力を生じます。
            </p>
          </section>

          <section>
            <h3>第8条（準拠法・管轄）</h3>
            <p>
              本規約は日本法に準拠します。
              本ツールに関する紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
