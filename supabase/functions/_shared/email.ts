// ============================================================
//  Edge Function 共用：Resend 交易 email
//  ------------------------------------------------------------
//  - sendEmail()：寄一封 HTML email（未設 RESEND_API_KEY → no-op 回 false）。
//  - alertAdmin()：寄系統告警去 ADMIN_ALERT_EMAIL（webhook 失敗等）。
//  secret（用 `supabase secrets set`）：
//    RESEND_API_KEY、RESEND_FROM（例：'NTK <noreply@yourdomain>'）、
//    ADMIN_ALERT_EMAIL。
// ============================================================

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM =
  Deno.env.get('RESEND_FROM') ?? 'NTK Platform <noreply@ntk-platform.example>'
const ADMIN_ALERT_EMAIL = Deno.env.get('ADMIN_ALERT_EMAIL') ?? ''

export const isEmailConfigured = Boolean(RESEND_API_KEY)

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<boolean> {
  if (!RESEND_API_KEY || !opts.to) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** 系統告警（webhook 失敗等）→ 寄去 ADMIN_ALERT_EMAIL；未設就 no-op。 */
export async function alertAdmin(
  subject: string,
  detail: string,
): Promise<void> {
  if (!ADMIN_ALERT_EMAIL) return
  await sendEmail({
    to: ADMIN_ALERT_EMAIL,
    subject: `[NTK Alert] ${subject}`,
    html: `<pre style="font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap">${escapeHtml(
      detail,
    )}</pre>`,
  }).catch(() => {})
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ── 範本 ──────────────────────────────────────────────────────
const BRAND = '#0d9488'

function shell(title: string, bodyHtml: string): string {
  return `<div style="font-family:ui-sans-serif,system-ui,'Noto Sans HK',sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
  <div style="background:${BRAND};color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:18px">NTK Platform</h1>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;padding:24px">
    <h2 style="margin:0 0 12px;font-size:16px">${title}</h2>
    ${bodyHtml}
    <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">NTK Platform · 香港教師工作台</p>
  </div>
</div>`
}

export function welcomeProEmail(): { subject: string; html: string } {
  return {
    subject: '歡迎升級 NTK Platform Pro 🎉',
    html: shell(
      '訂閱已生效',
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.6">多謝你升級 <strong>Pro</strong>！你而家可以無限使用教學 AI、多裝置即時同步同進階成績統計。</p>
       <p style="margin:0;font-size:14px;line-height:1.6">隨時喺「定價 → 管理訂閱」查看或調整你嘅訂閱。</p>`,
    ),
  }
}

export function canceledEmail(): { subject: string; html: string } {
  return {
    subject: 'NTK Platform 訂閱已取消',
    html: shell(
      '訂閱已取消',
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.6">你嘅 Pro 訂閱已取消，服務會維持到目前結算週期結束。</p>
       <p style="margin:0;font-size:14px;line-height:1.6">之後會自動轉返免費版；你嘅資料唔會受影響。隨時歡迎再升級。</p>`,
    ),
  }
}
