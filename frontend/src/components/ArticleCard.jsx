import { Link } from "react-router-dom";
import { Heart, MessageCircle, Eye, ArrowUpRight } from "lucide-react";
import { useCatalog } from "../contexts/CatalogContext";
import { mediaUrl } from "../api/client";
import { Avatar, displayName, formatDate, readTime } from "./UI";
export function ArticleCover({ article, large = false }) {
  const { categories } = useCatalog();
  const category = categories.find((item) => item.id === article.category);
  return (
    <div
      className={`article-cover tone-${article.category % 5} ${large ? "cover-large" : ""}`}
    >
      {article.thumbnail ? (
        <img src={mediaUrl(article.thumbnail)} alt="" loading="lazy" />
      ) : (
        <div className="cover-art" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
      <span className="cover-label">{category?.name || "История"}</span>
      <ArrowUpRight className="cover-arrow" size={22} />
    </div>
  );
}
export function ArticleCard({
  article,
  featured = false,
  manage = false,
  onDelete,
  onPublication,
  busy,
}) {
  const { categories } = useCatalog();
  const category = categories.find((item) => item.id === article.category);
  return (
    <article className={`article-card ${featured ? "featured-card" : ""}`}>
      <div className="article-card-body">
        <Link to={`/users/${article.author.id}`} className="author-line">
          <Avatar user={article.author} />
          <span>{displayName(article.author)}</span>
          <span className="author-dot">·</span>
          <span className="meta">{formatDate(article.published_date)}</span>
        </Link>
        <Link className="article-title-link" to={`/articles/${article.id}`}>
          <h2>{article.title}</h2>
        </Link>
        <p className="article-excerpt">
          {article.excerpt || article.content.slice(0, 150)}
        </p>
        <div className="article-meta">
          {category && (
            <Link className="category-pill" to={`/categories/${category.slug}`}>
              {category.name}
            </Link>
          )}
          {!article.is_published && (
            <span className="draft-label">Черновик</span>
          )}
          <span>{readTime(article.content)} мин. чтения</span>
          <span className="article-stat">
            <Heart size={14} />
            {article.like_count}
          </span>
          <span className="article-stat">
            <MessageCircle size={14} />
            {article.comment_count}
          </span>
          {manage && (
            <span className="article-stat">
              <Eye size={14} />
              {article.views_count}
            </span>
          )}
        </div>
        {manage && (
          <div className="manage-actions">
            <Link className="text-link" to={`/articles/${article.id}/edit`}>
              Редактировать
            </Link>
            <button
              className="text-link"
              disabled={busy}
              onClick={() => onPublication(article)}
            >
              {article.is_published ? "Снять с публикации" : "Опубликовать"}
            </button>
            <button
              className="text-link danger-text"
              disabled={busy}
              onClick={() => onDelete(article)}
            >
              Удалить
            </button>
          </div>
        )}
      </div>
      <Link
        className="article-cover-link"
        to={`/articles/${article.id}`}
        aria-label={`Читать: ${article.title}`}
      >
        <ArticleCover article={article} large={featured} />
      </Link>
    </article>
  );
}
