/** Temporary toast notification displayed in the bottom-right corner. Wrap with ToastProvider and call useToast() to show. */
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

interface ToastItem {
  id: number;
  message: string;
}

interface ToastContextValue {
  show: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string) => {
    const id = ++counter;
    setItems((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div
        className="fixed right-5 bottom-5 flex flex-col gap-2 z-[1000]"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="bg-[#1f2937] text-white px-4 py-2.5 rounded-md text-[13.5px] shadow-[0_4px_16px_rgba(0,0,0,0.2)] animate-in slide-in-from-bottom-2 fade-in duration-[180ms] ease-out"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
