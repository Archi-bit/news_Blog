import { useEffect, useRef, useId } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  AlertCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { mediaUrl, errorMessage } from "../api/client";
export const displayName = (user) =>
  `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
  user?.username ||
  "Автор";
export const formatDate = (date) =>
  date
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(date))
    : "Черновик";
export const readTime = (text) =>
  Math.max(1, Math.ceil((text || "").split(/\s+/).length / 180));
export function Avatar({ user, size = "small" }) {
  return (
    <span className={`avatar avatar-${size}`}>
      {user?.avatar ? (
        <img src={mediaUrl(user.avatar)} alt="" />
      ) : (
        displayName(user).slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function ErrorState({ error, retry }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={25} />
      <div>
        <h3>Не получилось загрузить данные</h3>
        <p>{errorMessage(error)}</p>
        {retry && (
          <button
            className="button button-small button-outline"
            onClick={retry}
          >
            Попробовать снова
          </button>
        )}
      </div>
    </div>
  );
}
export function EmptyState({
  title = "Пока здесь тихо",
  description = "Новые истории скоро появятся здесь.",
  action,
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <BookOpen size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Skeleton({ count = 3 }) {
  return (
    <div className="skeleton-list" aria-label="Загрузка" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-card" key={index}>
          <div className="skeleton sk-avatar" />
          <div className="skeleton sk-title" />
          <div className="skeleton sk-line" />
          <div className="skeleton sk-line short" />
        </div>
      ))}
    </div>
  );
}
export function Field({ label, name, error, children, hint }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children}
      {hint && <small id={`${name}-hint`}>{hint}</small>}
      {error && (
        <span id={`${name}-error`} className="field-error" role="alert">
          {Array.isArray(error) ? error.join(" ") : error}
        </span>
      )}
    </div>
  );
}
export function Pagination({ data, page, onPage }) {
  if (!data || (!data.previous && !data.next)) return null;
  return (
    <nav className="pagination" aria-label="Пагинация">
      <button
        className="button button-outline button-small"
        disabled={!data.previous}
        onClick={() => onPage(Math.max(1, page - 1))}
      >
        <ChevronLeft size={16} /> Назад
      </button>
      <span>Страница {page}</span>
      <button
        className="button button-outline button-small"
        disabled={!data.next}
        onClick={() => onPage(page + 1)}
      >
        Далее <ChevronRight size={16} />
      </button>
    </nav>
  );
}
export function ConfirmDialog({
  open,
  title,
  children,
  onCancel,
  onConfirm,
  busy,
  error,
}) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (open) ref.current.showModal();
    else if (ref.current.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      aria-labelledby={titleId}
    >
      <div className="dialog-inner">
        <button
          className="dialog-close"
          aria-label="Закрыть"
          disabled={busy}
          onClick={onCancel}
        >
          <X size={20} />
        </button>
        <h2 id={titleId}>{title}</h2>
        <p>{children}</p>
        {error && (
          <p className="field-error" role="alert">
            {errorMessage(error)}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button button-outline"
            disabled={busy}
            onClick={onCancel}
          >
            Отмена
          </button>
          <button
            className="button button-danger"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Удаление…" : "Удалить"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
export function TextLink({ to, children }) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowRight size={16} />
    </Link>
  );
}
