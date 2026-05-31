import { useState } from 'react'
import { Activity, Dumbbell, Apple, Bot, BookOpen } from 'lucide-react'
import { SegmentedControl } from '../../ui'
import BodyView from './fitness/body/BodyView'
import TrainingView from './fitness/training/TrainingView'
import NutritionView from './fitness/nutrition/NutritionView'
import CoachView from './fitness/coach/CoachView'
import LibraryView from './fitness/library/LibraryView'

// ============================================================
//  健身中心 shell —— 個人模式「健身」分區，內含 5 個工具 tab。
//  各 tab 係自足模組（自己 store/util/charts），喺呢度切換顯示。
// ============================================================

type Tab = 'body' | 'training' | 'nutrition' | 'coach' | 'library'

export default function Fitness() {
  const [tab, setTab] = useState<Tab>('body')
  return (
    <div className="space-y-5">
      {/* tab 切換（手機可橫向捲） */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { id: 'body', label: '體態', icon: Activity },
            { id: 'training', label: '訓練', icon: Dumbbell },
            { id: 'nutrition', label: '飲食', icon: Apple },
            { id: 'coach', label: 'AI 教練', icon: Bot },
            { id: 'library', label: '動作庫', icon: BookOpen },
          ]}
        />
      </div>

      {tab === 'body' && <BodyView />}
      {tab === 'training' && <TrainingView />}
      {tab === 'nutrition' && <NutritionView />}
      {tab === 'coach' && <CoachView />}
      {tab === 'library' && <LibraryView />}
    </div>
  )
}
