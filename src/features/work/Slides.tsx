import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import './slides/i18n'
import { Button, EmptyState, cx } from '../../ui'
import { useAuth } from '../../context/AuthContext'
import { isAIConfigured } from '../../lib/aiClient'
import { useCollection } from '../../lib/store'
import { slideDecksCol } from './slides/store'
import Generator from './slides/Generator'
import FromPlan from './slides/FromPlan'
import DeckView from './slides/DeckView'
import DeckEditor from './slides/DeckEditor'

export default function Slides() {
  const { t } = useTranslation()
  const { user, configured, signInWithGoogle } = useAuth()
  const [tab, setTab] = useState<'gen' | 'plan' | 'mine'>('gen')
  const [editId, setEditId] = useState<string | null>(null)
  const decks = useCollection(slideDecksCol)

  if (!isAIConfigured) {
    return <EmptyState icon={Sparkles} title={t('slides.needSupabase', { defaultValue: 'AI 簡報需要接好 Supabase + Gemini' })} hint={t('slides.setupHint', { defaultValue: '設定步驟見 docs/SETUP.md。' })} />
  }
  if (!user) {
    return <EmptyState icon={Sparkles} title={t('slides.loginTitle', { defaultValue: '登入先可以生成簡報' })} hint={t('slides.loginHint', { defaultValue: 'AI 功能經你自己嘅 Supabase + Gemini 運作。' })}
      action={configured ? <Button onClick={() => void signInWithGoogle()}>{t('slides.loginBtn', { defaultValue: '用 Google 登入' })}</Button> : undefined} />
  }

  if (editId) {
    const editDeck = decks.find((d) => d.id === editId)
    if (!editDeck) {
      setEditId(null)
    } else {
      return <DeckEditor deck={editDeck} onClose={() => setEditId(null)} />
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
        {(['gen', 'plan', 'mine'] as const).map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className={cx('flex-1 rounded-md px-3 py-1.5 font-medium transition',
              tab === tb ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100' : 'text-slate-500')}>
            {tb === 'gen'
              ? t('slides.tabGenerate', { defaultValue: '生成' })
              : tb === 'plan'
                ? t('slides.tabFromPlan', { defaultValue: '由教案' })
                : t('slides.tabMine', { defaultValue: '我的簡報' })}
          </button>
        ))}
      </div>
      {tab === 'gen'
        ? <Generator onCreated={() => setTab('mine')} />
        : tab === 'plan'
          ? <FromPlan onCreated={() => setTab('mine')} />
          : decks.length === 0
            ? <p className="py-10 text-center text-sm text-slate-400">{t('slides.emptyMine', { defaultValue: '仲未有簡報，喺「生成」或「由教案」整一份。' })}</p>
            : <div className="space-y-8">{decks.map((d) => <DeckView key={d.id} deck={d} onEdit={() => setEditId(d.id)} />)}</div>}
    </div>
  )
}
