import { useState } from 'react';
import { useCollection } from '../../lib/store';
import { inboxCol, tasksCol, notesCol } from '../../data/collections';

export default function Inbox() {
  const items = useCollection(inboxCol);
  const [text, setText] = useState('');

  const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const capture = () => {
    const value = text.trim();
    if (!value) return;
    inboxCol.add({ text: value, createdAt: new Date().toISOString() });
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      capture();
    }
  };

  const toTask = (id: string, itemText: string) => {
    tasksCol.add({ text: itemText, done: false, createdAt: new Date().toISOString() });
    inboxCol.remove(id);
  };

  const toNote = (id: string, itemText: string) => {
    notesCol.add({ content: itemText, createdAt: new Date().toISOString() });
    inboxCol.remove(id);
  };

  const remove = (id: string) => {
    inboxCol.remove(id);
  };

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <header className="mb-4 sm:mb-6">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">快速擷取 Inbox</h1>
        <p className="mt-1 text-sm text-slate-500">
          一秒掉低一個諗法，遲啲再整理成待辦或筆記。
        </p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="掉低一個諗法⋯⋯"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="button"
          onClick={capture}
          className="shrink-0 rounded-xl bg-accent px-5 py-2.5 font-medium text-white transition-colors hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          擷取
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between sm:mt-6">
        <span className="text-sm text-slate-500">總共 {sorted.length} 項</span>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-500">Inbox 空空如也 ✨</p>
          <p className="mt-1 text-sm text-slate-400">有諗法就即刻掉低，唔使諗點分類。</p>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {sorted.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <p className="whitespace-pre-wrap break-words text-slate-900">{item.text}</p>
              <p className="mt-1 text-xs text-slate-400">
                {new Date(item.createdAt).toLocaleString('zh-HK')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toTask(item.id, item.text)}
                  className="rounded-xl bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent-strong transition-colors hover:bg-accent hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  轉做待辦 ✅
                </button>
                <button
                  type="button"
                  onClick={() => toNote(item.id, item.text)}
                  className="rounded-xl bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent-strong transition-colors hover:bg-accent hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  轉做筆記 📝
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  刪除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
