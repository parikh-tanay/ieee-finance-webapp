'use client';

export type Toast = { id: string; message: string; tone: 'income' | 'expense' };

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-xs">
      {toasts.map(t => (
        <div key={t.id}
          className="toast-in rounded-lg px-4 py-3 text-sm shadow-lg"
          style={{
            background: '#1A1E27',
            border: `1px solid ${t.tone === 'income' ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'}`,
            color: '#EDEDEF',
          }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
