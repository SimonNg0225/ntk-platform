// ============================================================
//  教師頭像 persona 生成器（build-time，一次過）
//  ------------------------------------------------------------
//  用 DiceBear avataaars（devDependency）逐個 persona 出一張靜態 SVG，
//  寫去 public/personas/<id>.svg；app 行時用 <img> 引，唔使帶 DiceBear engine。
//  同時寫 src/lib/personas.generated.ts（id / gender / age 中繼資料，畀 UI 用）。
//
//  改 persona ⇒ 改下面 SPEC ⇒ `npm run gen:personas` 重新生成。
//  enum 值對齊 @dicebear/avataaars@9 schema（top 係短名：shortFlat / straight01…）。
// ============================================================
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createAvatar } from '@dicebear/core'
import { avataaars } from '@dicebear/collection'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svgDir = join(root, 'public', 'personas')
const genFile = join(root, 'src', 'lib', 'personas.generated.ts')

// id 格式 m-01..m-10 / f-01..f-10；top 用 avataaars v9 短名。
// 覆蓋年齡（young / mid / senior，senior 用灰髮）同特色（眼鏡 / 鬍鬚 / 膚色 / 衣著）。
const SPEC = [
  // ── 男老師 ──
  { id: 'm-01', gender: 'male', age: 'young', top: 'shortFlat', hair: '2c1b18', skin: 'ffdbb4', clothing: 'shirtVNeck', clothesColor: '5199e4' },
  { id: 'm-02', gender: 'male', age: 'young', top: 'shortCurly', hair: '724133', skin: 'edb98a', clothing: 'shirtCrewNeck', clothesColor: '65c9ff' },
  { id: 'm-03', gender: 'male', age: 'mid', top: 'shortWaved', hair: '2c1b18', skin: 'edb98a', clothing: 'blazerAndShirt', clothesColor: '262e33', beard: 'beardLight', beardColor: '2c1b18', accessory: 'prescription02' },
  { id: 'm-04', gender: 'male', age: 'mid', top: 'sides', hair: '724133', skin: 'd08b5b', clothing: 'collarAndSweater', clothesColor: '3c4f5c', beard: 'moustacheFancy', beardColor: '724133' },
  { id: 'm-05', gender: 'male', age: 'mid', top: 'theCaesar', hair: '2c1b18', skin: 'ae5d29', clothing: 'shirtVNeck', clothesColor: '929598', beard: 'beardMedium', beardColor: '2c1b18' },
  { id: 'm-06', gender: 'male', age: 'senior', top: 'shortFlat', hair: 'b7b7b7', skin: 'edb98a', clothing: 'blazerAndSweater', clothesColor: '25557c', beard: 'beardLight', beardColor: 'b7b7b7', accessory: 'prescription01' },
  { id: 'm-07', gender: 'male', age: 'senior', top: 'sides', hair: 'b7b7b7', skin: 'd08b5b', clothing: 'collarAndSweater', clothesColor: '5199e4' },
  { id: 'm-08', gender: 'male', age: 'young', top: 'frizzle', hair: '2c1b18', skin: '614335', clothing: 'shirtCrewNeck', clothesColor: 'ff5c5c' },
  { id: 'm-09', gender: 'male', age: 'mid', top: 'shortRound', hair: 'a55728', skin: 'edb98a', clothing: 'blazerAndShirt', clothesColor: '3c4f5c', beard: 'beardLight', beardColor: 'a55728' },
  { id: 'm-10', gender: 'male', age: 'young', top: 'dreads01', hair: '2c1b18', skin: 'ae5d29', clothing: 'hoodie', clothesColor: '25557c' },
  // ── 女老師 ──
  { id: 'f-01', gender: 'female', age: 'young', top: 'straight01', hair: '2c1b18', skin: 'ffdbb4', clothing: 'shirtVNeck', clothesColor: 'ff488e' },
  { id: 'f-02', gender: 'female', age: 'young', top: 'curly', hair: '724133', skin: 'edb98a', clothing: 'shirtScoopNeck', clothesColor: 'ffafb9', accessory: 'round' },
  { id: 'f-03', gender: 'female', age: 'mid', top: 'bob', hair: '2c1b18', skin: 'edb98a', clothing: 'blazerAndShirt', clothesColor: '262e33' },
  { id: 'f-04', gender: 'female', age: 'mid', top: 'bun', hair: '724133', skin: 'd08b5b', clothing: 'collarAndSweater', clothesColor: '3c4f5c', accessory: 'prescription01' },
  { id: 'f-05', gender: 'female', age: 'mid', top: 'miaWallace', hair: 'a55728', skin: 'ffdbb4', clothing: 'blazerAndSweater', clothesColor: '25557c' },
  { id: 'f-06', gender: 'female', age: 'senior', top: 'straight02', hair: 'b7b7b7', skin: 'edb98a', clothing: 'collarAndSweater', clothesColor: '929598' },
  { id: 'f-07', gender: 'female', age: 'senior', top: 'bun', hair: 'd6d6d6', skin: 'd08b5b', clothing: 'blazerAndShirt', clothesColor: '5199e4', accessory: 'prescription02' },
  { id: 'f-08', gender: 'female', age: 'young', top: 'fro', hair: '2c1b18', skin: '614335', clothing: 'shirtScoopNeck', clothesColor: 'a7ffc4' },
  { id: 'f-09', gender: 'female', age: 'mid', top: 'curvy', hair: '724133', skin: 'edb98a', clothing: 'shirtVNeck', clothesColor: 'b1e2ff' },
  { id: 'f-10', gender: 'female', age: 'young', top: 'longButNotTooLong', hair: 'b58143', skin: 'ffdbb4', clothing: 'shirtCrewNeck', clothesColor: 'ff5c5c' },
]

function optionsFor(s) {
  return {
    seed: s.id,
    backgroundColor: ['transparent'],
    top: [s.top],
    topProbability: 100,
    hairColor: [s.hair],
    skinColor: [s.skin],
    clothing: [s.clothing],
    clothesColor: [s.clothesColor],
    facialHair: s.beard ? [s.beard] : undefined,
    facialHairColor: s.beardColor ? [s.beardColor] : undefined,
    facialHairProbability: s.beard ? 100 : 0,
    accessories: s.accessory ? [s.accessory] : undefined,
    accessoriesProbability: s.accessory ? 100 : 0,
  }
}

await rm(svgDir, { recursive: true, force: true })
await mkdir(svgDir, { recursive: true })

let ok = 0
for (const s of SPEC) {
  const svg = createAvatar(avataaars, optionsFor(s)).toString()
  await writeFile(join(svgDir, `${s.id}.svg`), svg, 'utf8')
  ok++
}

const meta = SPEC.map((s) => `  { id: '${s.id}', gender: '${s.gender}', age: '${s.age}' },`).join('\n')
const ts = `// ⚠️ AUTO-GENERATED by scripts/gen-personas.mjs —— 唔好手改。改 persona 請改腳本再 \`npm run gen:personas\`。
export type PersonaGender = 'male' | 'female'
export type PersonaAge = 'young' | 'mid' | 'senior'
export interface PersonaMeta {
  id: string
  gender: PersonaGender
  age: PersonaAge
}

/** 全部教師 persona（中繼資料；SVG 喺 public/personas/<id>.svg）。 */
export const PERSONAS: readonly PersonaMeta[] = [
${meta}
]
`
await writeFile(genFile, ts, 'utf8')

console.log(`✓ 生成 ${ok} 個 persona SVG → public/personas/`)
console.log(`✓ 寫 ${SPEC.length} 條中繼資料 → src/lib/personas.generated.ts`)
