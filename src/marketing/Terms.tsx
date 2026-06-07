import LegalLayout, { LegalSection } from './LegalLayout'

export default function Terms() {
  return (
    <LegalLayout title="服務條款" updated="2026 年 6 月 7 日">
      <p>
        歡迎使用 NTK Platform（「本平台」）。當你使用本平台，即表示你同意以下條款。
        如不同意，請停止使用。
      </p>

      <LegalSection no={1} title="服務說明">
        <p>
          本平台為香港教師提供備課、出題、成績管理、點名、家長溝通、行政文件及
          AI 教學助手等工具。我哋可能不時更新、增刪功能。
        </p>
      </LegalSection>

      <LegalSection no={2} title="帳戶">
        <p>
          部分功能需以 Google 帳戶登入。你須對帳戶活動及所輸入內容負責，並確保
          處理學生資料時符合所屬學校之政策及適用法律。
        </p>
      </LegalSection>

      <LegalSection no={3} title="可接受使用">
        <p>
          你同意不會將平台用於違法用途、上載侵權或不當內容、嘗試干擾系統運作，
          或繞過使用額度及安全限制。
        </p>
      </LegalSection>

      <LegalSection no={4} title="訂閱與收費">
        <ul className="list-disc space-y-1 pl-5">
          <li>免費版提供核心功能及每日 AI 使用額度。</li>
          <li>
            Pro 為週期性訂閱，由 Stripe 收費，到期自動續訂，直至你取消。
          </li>
          <li>你可隨時在客戶中心取消，服務維持至當期結束。</li>
          <li>除適用法律另有規定外，已付款項一般不獲退還。</li>
        </ul>
      </LegalSection>

      <LegalSection no={5} title="AI 內容免責">
        <p>
          AI 生成之題目、教案、評語等僅供參考，可能有錯誤或不準確之處。你須在
          專業判斷下自行覆核，方可用於教學或評估。
        </p>
      </LegalSection>

      <LegalSection no={6} title="你的資料與內容">
        <p>
          你保留對自己輸入內容嘅權利。你授權我哋為提供服務所需而處理及儲存有關
          內容（包括雲端同步及 AI 處理）。資料處理詳見私隱政策。
        </p>
      </LegalSection>

      <LegalSection no={7} title="知識產權">
        <p>
          平台之軟件、設計及商標屬本平台或其授權人所有，未經許可不得複製或再分發。
        </p>
      </LegalSection>

      <LegalSection no={8} title="免責聲明與責任限制">
        <p>
          本平台按「現狀」提供，不就特定用途之適用性作任何明示或默示保證。在
          適用法律允許之最大範圍內，我哋不就任何間接或後果性損失承擔責任。
        </p>
      </LegalSection>

      <LegalSection no={9} title="終止">
        <p>
          你可隨時停止使用並刪除資料。若你嚴重違反本條款，我哋可暫停或終止你的
          帳戶。
        </p>
      </LegalSection>

      <LegalSection no={10} title="條款修改">
        <p>
          我哋可不時更新本條款，並在本頁公布更新日期。重大變更會盡量另行通知。
        </p>
      </LegalSection>

      <LegalSection no={11} title="適用法律">
        <p>
          本條款受香港特別行政區法律管轄，並按其詮釋。
        </p>
      </LegalSection>

      <LegalSection no={12} title="聯絡我哋">
        <p>
          查詢請電郵至 <strong>support@ntk-platform.example</strong>。
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
