import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Pencil, Trash2 } from "lucide-react";
import { api, errorMessage } from "../api/client";
import { useResource } from "../hooks/useResource";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import {
  Avatar,
  ConfirmDialog,
  displayName,
  EmptyState,
  ErrorState,
  formatDate,
  Pagination,
  Skeleton,
} from "./UI";
export function Comments({ article, onCountChange }) {
  const { user } = useAuth();
  const notify = useToast();
  const [page, setPage] = useState(1);
  const resource = useResource(`articles/${article.id}/comments/`, { page });
  const [text, setText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const [editError, setEditError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api.post(`articles/${article.id}/comments/`, { text: text.trim() });
      setText("");
      onCountChange(1);
      if (page !== 1) setPage(1);
      else resource.refetch();
      notify("Комментарий добавлен");
    } catch (error) {
      setFormError(error);
    } finally {
      setBusy(false);
    }
  }
  async function edit(event) {
    event.preventDefault();
    setBusy(true);
    setEditError(null);
    try {
      await api.patch(`comments/${editId}/`, { text: editText.trim() });
      setEditId(null);
      resource.refetch();
      notify("Комментарий обновлён");
    } catch (error) {
      setEditError(error);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setDeleteError(null);
    try {
      await api.delete(`comments/${deleteTarget.id}/`);
      setDeleteTarget(null);
      onCountChange(-1);
      if (resource.data.results.length === 1 && page > 1)
        setPage((value) => value - 1);
      else resource.refetch();
      notify("Комментарий удалён");
    } catch (error) {
      setDeleteError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="comments-section" id="comments">
      <h2>
        <MessageCircle size={23} />
        Обсуждение <span className="count-badge">{article.comment_count}</span>
      </h2>
      {user ? (
        <form className="comment-form" onSubmit={create}>
          <Avatar user={user} />
          <div>
            <label className="sr-only" htmlFor="comment-text">
              Ваш комментарий
            </label>
            <textarea
              id="comment-text"
              placeholder="Что вы думаете об этой истории?"
              required
              maxLength={10000}
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={busy}
            />
            {formError && (
              <p role="alert" className="field-error">
                {errorMessage(formError)}
              </p>
            )}
            <button
              type="submit"
              className="button button-small"
              disabled={busy || !text.trim()}
            >
              {busy ? "Сохраняем…" : "Отправить комментарий"}
            </button>
          </div>
        </form>
      ) : (
        <div className="comment-login">
          Войдите, чтобы присоединиться к обсуждению.{" "}
          <Link
            className="text-link"
            to={`/login?next=${encodeURIComponent(`/articles/${article.id}#comments`)}`}
          >
            Войти
          </Link>
        </div>
      )}
      {resource.loading ? (
        <Skeleton count={2} />
      ) : resource.error ? (
        <ErrorState error={resource.error} retry={resource.refetch} />
      ) : !resource.data.results.length ? (
        <EmptyState
          title="Начните разговор"
          description="Здесь пока нет комментариев. Поделитесь своим взглядом."
        />
      ) : (
        <div className="comments-list">
          {resource.data.results.map((comment) => (
            <article className="comment" key={comment.id}>
              <Link
                to={`/users/${comment.author.id}`}
                aria-label={`Профиль ${displayName(comment.author)}`}
              >
                <Avatar user={comment.author} />
              </Link>
              <div className="comment-content">
                <div className="comment-heading">
                  <Link
                    to={`/users/${comment.author.id}`}
                    aria-label={`Профиль ${displayName(comment.author)}`}
                  >
                    {displayName(comment.author)}
                  </Link>
                  <time dateTime={comment.created_date}>
                    {formatDate(comment.created_date)}
                  </time>
                </div>
                {editId === comment.id ? (
                  <form onSubmit={edit}>
                    <label
                      className="sr-only"
                      htmlFor={`edit-comment-${comment.id}`}
                    >
                      Редактировать комментарий
                    </label>
                    <textarea
                      id={`edit-comment-${comment.id}`}
                      required
                      maxLength={10000}
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                      disabled={busy}
                    />
                    {editError && (
                      <p className="field-error" role="alert">
                        {errorMessage(editError)}
                      </p>
                    )}
                    <div className="inline-actions">
                      <button
                        className="button button-small"
                        disabled={busy || !editText.trim()}
                        type="submit"
                      >
                        Сохранить
                      </button>
                      <button
                        className="button button-small button-outline"
                        type="button"
                        disabled={busy}
                        onClick={() => setEditId(null)}
                      >
                        Отмена
                      </button>
                    </div>
                  </form>
                ) : (
                  <p>{comment.text}</p>
                )}
                {user &&
                  (user.id === comment.author.id || user.is_staff) &&
                  editId !== comment.id && (
                    <div className="comment-actions">
                      <button
                        disabled={busy}
                        onClick={() => {
                          setEditId(comment.id);
                          setEditText(comment.text);
                          setEditError(null);
                        }}
                      >
                        <Pencil size={13} />
                        Редактировать
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(comment);
                        }}
                      >
                        <Trash2 size={13} />
                        Удалить
                      </button>
                    </div>
                  )}
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination data={resource.data} page={page} onPage={setPage} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Удалить комментарий?"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={remove}
        busy={busy}
        error={deleteError}
      >
        Ваш комментарий исчезнет из обсуждения.
      </ConfirmDialog>
    </section>
  );
}
