import { createContext, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
const ToastContext = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Set());
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  function notify(message, kind = "success") {
    const id = crypto.randomUUID();
    setToasts((items) => [...items, { id, message, kind }]);
    const timer = setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
      timers.current.delete(timer);
    }, 5500);
    timers.current.add(timer);
  }
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div className={`toast ${toast.kind}`} key={toast.id}>
            {toast.kind === "error" ? (
              <AlertCircle size={19} />
            ) : (
              <CheckCircle2 size={19} />
            )}
            <span>{toast.message}</span>
            <button
              aria-label="Закрыть уведомление"
              onClick={() =>
                setToasts((items) =>
                  items.filter((item) => item.id !== toast.id),
                )
              }
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
