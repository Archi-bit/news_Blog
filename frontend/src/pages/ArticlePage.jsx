import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Eye,
  Share2,
  PenLine,
  Trash2,
} from "lucide-react";
import { api, errorMessage } from "../api/client";
import { useResource } from "../hooks/useResource";
import { useAuth } from "../contexts/AuthContext";
import { useCatalog } from "../contexts/CatalogContext";
import { useToast } from "../contexts/ToastContext";
import { ArticleCover } from "../components/ArticleCard";
import { FollowButton } from "../components/FollowButton";
import { Comments } from "../components/Comments";
import {
  Avatar,
  ConfirmDialog,
  displayName,
  ErrorState,
  formatDate,
  readTime,
  Skeleton,
} from "../components/UI";
export function ArticlePage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { categories, tags } = useCatalog();
  const resource = useResource(authLoading ? null : `articles/${id}/`);
  const notify = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  if (authLoading || resource.loading) return <Skeleton />;
  if (resource.error)
    return <ErrorState error={resource.error} retry={resource.refetch} />;
  if (!resource.data) return null;
  const article = resource.data;
  const category = categories.find((item) => item.id === article.category);
  const canEdit = user && (user.id === article.author.id || user.is_staff);
  async function like() {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/articles/${id}`)}`);
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.request({
        url: `articles/${id}/like/`,
        method: article.is_liked ? "delete" : "post",
      });
      resource.setData((current) => ({ ...current, ...data }));
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }
  async function publication() {
    setBusy(true);
    try {
      const { data } = await api.post(
        `articles/${id}/${article.is_published ? "unpublish" : "publish"}/`,
      );
      resource.setData(data);
      notify(
        article.is_published
          ? "Статья снята с публикации"
          : "Статья опубликована",
      );
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setDeleteError(null);
    try {
      await api.delete(`articles/${id}/`);
      notify("Статья удалена");
      navigate("/my-articles");
    } catch (error) {
      setDeleteError(error);
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify("Ссылка скопирована");
    } catch {
      notify(
        "Не удалось скопировать ссылку. Скопируйте адрес из строки браузера.",
        "error",
      );
    }
  }
  return (
    <div className="reading-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} />К историям
      </Link>
      <article>
        <div className="reading-heading">
          {category && (
            <Link className="eyebrow" to={`/categories/${category.slug}`}>
              {category.name}
            </Link>
          )}
          {!article.is_published && (
            <span className="draft-label">
              Черновик · виден автору и администратору
            </span>
          )}
          <h1>{article.title}</h1>
          {article.excerpt && (
            <p className="reading-excerpt">{article.excerpt}</p>
          )}
          <div className="reading-author-row">
            <Link to={`/users/${article.author.id}`} className="reading-author">
              <Avatar user={article.author} size="medium" />
              <span>
                <strong>{displayName(article.author)}</strong>
                <small>
                  {formatDate(article.published_date)} ·{" "}
                  {readTime(article.content)} мин. чтения
                </small>
              </span>
            </Link>
            <FollowButton target={article.author} />
          </div>
        </div>
        {canEdit && (
          <div className="article-owner-tools">
            <Link className="text-link" to={`/articles/${id}/edit`}>
              <PenLine size={16} />
              Редактировать
            </Link>
            <button className="text-link" disabled={busy} onClick={publication}>
              {article.is_published ? "Снять с публикации" : "Опубликовать"}
            </button>
            <button
              className="text-link danger-text"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={15} />
              Удалить
            </button>
          </div>
        )}
        <ArticleCover article={article} large />
        <div className="reading-body">
          {article.content.split(/\n\s*\n/).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <div className="reading-tags">
          {article.tags
            .map((tagId) => tags.find((tag) => tag.id === tagId))
            .filter(Boolean)
            .map((tag) => (
              <Link
                to={`/search?tag=${encodeURIComponent(tag.slug)}`}
                key={tag.id}
              >
                #{tag.name}
              </Link>
            ))}
        </div>
        <div className="reading-actions">
          {article.is_published && (
            <>
              <button
                className={`like-button ${article.is_liked ? "liked" : ""}`}
                disabled={busy}
                onClick={like}
                aria-pressed={article.is_liked}
                aria-label={article.is_liked ? "Убрать лайк" : "Поставить лайк"}
              >
                <Heart
                  size={21}
                  fill={article.is_liked ? "currentColor" : "none"}
                />
                <span>{article.like_count}</span>
              </button>
              <a href="#comments" aria-label="Перейти к комментариям">
                <MessageCircle size={21} />
                {article.comment_count}
              </a>
            </>
          )}
          <span>
            <Eye size={20} />
            {article.views_count}
          </span>
          <button className="share-button" onClick={share}>
            <Share2 size={18} />
            Поделиться
          </button>
        </div>
        <div className="author-bio-card">
          <Avatar user={article.author} size="large" />
          <div>
            <span className="eyebrow">Автор истории</span>
            <Link to={`/users/${article.author.id}`}>
              <h3>{displayName(article.author)}</h3>
            </Link>
            <p>
              {article.author.bio ||
                "Делится историями, опытом и хорошими идеями."}
            </p>
          </div>
          <FollowButton target={article.author} />
        </div>
      </article>
      {article.is_published && (
        <Comments
          key={article.id}
          article={article}
          onCountChange={(delta) =>
            resource.setData((current) => ({
              ...current,
              comment_count: Math.max(0, current.comment_count + delta),
            }))
          }
        />
      )}
      <ConfirmDialog
        open={confirm}
        title="Удалить эту историю?"
        onCancel={() => setConfirm(false)}
        onConfirm={remove}
        busy={busy}
        error={deleteError}
      >
        Статья и все её комментарии будут удалены без возможности
        восстановления.
      </ConfirmDialog>
    </div>
  );
}
