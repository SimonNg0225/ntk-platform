// pizzip 無官方 TS types —— 最小宣告（docxtemplater + adminDocs docxEngine 需要）。
// 只覆蓋本 app 用到嘅 API；如需更多可自行擴充。
declare module 'pizzip' {
  export default class PizZip {
    constructor(
      data?: string | ArrayBuffer | Uint8Array | number[],
      options?: Record<string, unknown>,
    )
    // 讀：回 file 物件（搵唔到回 null）。
    file(
      path: string,
    ): { asText(): string; asArrayBuffer(): ArrayBuffer; asUint8Array(): Uint8Array } | null
    // 寫：放入內容（回 this，可鏈式）。砌 zip / 測試 fixture 用。
    file(
      path: string,
      content: string | ArrayBuffer | Uint8Array | number[],
      options?: Record<string, unknown>,
    ): PizZip
    generate(options?: Record<string, unknown>): Blob
  }
}
