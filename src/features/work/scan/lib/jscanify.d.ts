// 用 'jscanify/client'（瀏覽器版，靠全域 cv + document.createElement）。
// 注意：bare 'jscanify' 會 resolve 去 Node 版（require canvas/jsdom），瀏覽器行唔到。
declare module 'jscanify/client' {
  /** 角點，每個有 x / y。 */
  export interface CornerPoint {
    x: number
    y: number
  }

  /** getCornerPoints 回傳（個別角可能 undefined）。 */
  export interface CornerPoints {
    topLeftCorner?: CornerPoint
    topRightCorner?: CornerPoint
    bottomLeftCorner?: CornerPoint
    bottomRightCorner?: CornerPoint
  }

  export default class jscanify {
    /** 偵紙張輪廓（傳 cv.Mat），回最大 contour 或 null。 */
    findPaperContour(img: any): any | null
    /** 由 contour 計四角。 */
    getCornerPoints(contour: any): CornerPoints
    /** 拉正透視；冇 cornerPoints 又偵唔到紙會回 null。image 可以係 canvas/img。 */
    extractPaper(
      image: HTMLCanvasElement | HTMLImageElement,
      resultWidth: number,
      resultHeight: number,
      cornerPoints?: CornerPoints,
    ): HTMLCanvasElement | null
  }
}
