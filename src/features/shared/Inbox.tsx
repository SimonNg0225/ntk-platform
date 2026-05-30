import { useState } from 'react';
import { useCollection } from '../../lib/store';
import { inboxCol, tasksCol, notesCol } from '../../data/collections';
import { Input, Button, Card, Badge, EmptyState } from '../../ui';

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
        <Input
          type="text"
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="掉低一個諗法⋯⋯"
        />
        <Button type="button" onClick={capture} className="shrink-0">
          擷取
        </Button>
      </div>

      <div className="mt-4 flex items-center justify-between sm:mt-6">
        <Badge tone="accent">總共 {sorted.length} 項</Badge>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon="✨"
            title="Inbox 空空如也"
            hint="有諗法就即刻掉低，唔使諗點分類。"
          />
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {sorted.map((item) => (
            <Card key={item.id} className="p-4">
              <p className="whitespace-pre-wrap break-words text-slate-900">{item.text}</p>
              <p className="mt-1 text-xs text-slate-400">
                {new Date(item.createdAt).toLocaleString('zh-HK')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => toTask(item.id, item.text)}
                >
                  轉做待辦 ✅
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => toNote(item.id, item.text)}
                >
                  轉做筆記 📝
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(item.id)}
                >
                  刪除
                </Button>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
