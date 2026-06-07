import LegalLayout, { LegalSection } from './LegalLayout'

export default function Privacy() {
  return (
    <LegalLayout title="私隱政策" updated="2026 年 6 月 7 日">
      <p>
        NTK Platform（「本平台」）尊重並保障你的個人資料私隱。本政策說明我哋會
        收集咩資料、點樣使用同保護，以及你擁有嘅權利。本平台主要為香港教育工作者
        而設，會按香港《個人資料（私隱）條例》（第 486 章）行事。
      </p>

      <LegalSection no={1} title="我哋收集嘅資料">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>帳戶資料</strong>：你用 Google 登入時提供嘅名稱同電郵地址。
          </li>
          <li>
            <strong>你輸入嘅內容</strong>：筆記、班別、成績、教案、題目等。預設只
            存喺你裝置嘅瀏覽器（localStorage）；登入後會同步到我哋嘅雲端供應商
            Supabase。
          </li>
          <li>
            <strong>AI 請求</strong>：你使用教學 AI 時輸入嘅文字／圖片，會經我哋
            的伺服器代理送往 Google Gemini 處理，用以生成回應。
          </li>
          <li>
            <strong>付款資料</strong>：訂閱由 Stripe 處理；我哋<strong>不會</strong>
            儲存你的信用卡號碼。
          </li>
          <li>
            <strong>分析與診斷</strong>：在你<strong>同意</strong>後，我哋會用
            PostHog 收集匿名使用統計；並用 Sentry 收集錯誤報告以改善穩定性。
          </li>
        </ul>
      </LegalSection>

      <LegalSection no={2} title="使用目的">
        <p>
          提供及維運平台功能、雲端同步、處理訂閱、改善產品體驗、保障系統安全及
          履行法律責任。我哋<strong>不會</strong>出售你的個人資料。
        </p>
      </LegalSection>

      <LegalSection no={3} title="第三方服務">
        <p>
          本平台依賴以下服務商，各自有其私隱政策：Supabase（雲端儲存／驗證）、
          Google Gemini（AI）、Stripe（付款）、PostHog（分析）、Sentry（錯誤監控）、
          Vercel（寄存）。
        </p>
      </LegalSection>

      <LegalSection no={4} title="資料儲存與保安">
        <p>
          雲端資料以行級安全（RLS）隔離，確保每位用戶只可存取自己嘅資料。我哋採取
          合理技術措施保護資料，但互聯網傳輸無法保證絕對安全。
        </p>
      </LegalSection>

      <LegalSection no={5} title="你的權利">
        <p>
          你可隨時在「設定」匯出或清除本機資料，亦可要求查閱、更正或刪除我哋持有
          的個人資料。你可在 Cookie 橫額或瀏覽器設定撤回分析同意。
        </p>
      </LegalSection>

      <LegalSection no={6} title="Cookie 與分析">
        <p>
          我哋只在你「接受」後才載入分析 cookie。拒絕不會影響核心功能。錯誤監控
          屬維持服務之正當利益。
        </p>
      </LegalSection>

      <LegalSection no={7} title="兒童">
        <p>
          平台供教師專業使用。我哋不會主動向兒童收集個人資料；老師輸入嘅學生資料
          由老師按校方政策負責管理。
        </p>
      </LegalSection>

      <LegalSection no={8} title="聯絡我哋">
        <p>
          如對私隱有任何查詢，請電郵至 <strong>privacy@ntk-platform.example</strong>。
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
