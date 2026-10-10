import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PenLine } from "lucide-react";
import { api, errorMessage } from "../api/client";
import { useResource } from "../hooks/useResource";
import { useToast } from "../contexts/ToastContext";
import { ArticleCard } from "./ArticleCard";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
} from "./UI";
export function ArticleFeed({
  path = "articles/",
  params = {},
  title = "Свежие публикации",
  manage = false,
  featured = false,
  emptyTitle,
  emptyDescription,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const ordering = searchParams.get("ordering") || "-published_date";
  const { data, loading, error, refetch } = useResource(path, {
    ...params,
    page,
    ordering,
  });
  const notify = useToast();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  function query(key, value) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set(key, value);
      if (key !== "page") next.delete("page");
      return next;
    });
  }
  async function remove() {
    setBusyId(deleteTarget.id);
    setDeleteError(null);
    try {
      await api.delete(`articles/${deleteTarget.id}/`);
      setDeleteTarget(null);
      notify("Статья удалена");
      if (data.results.length === 1 && page > 1) query("page", page - 1);
      else refetch();
    } catch (problem) {
      setDeleteError(problem);
    } finally {
      setBusyId(null);
    }
  }
  async function publish(article) {
    setBusyId(article.id);
    try {
      await api.post(
        `articles/${article.id}/${article.is_published ? "unpublish" : "publish"}/`,
      );
      notify(
        article.is_published
          ? "Статья снята с публикации"
          : "Статья опубликована",
      );
      refetch();
    } catch (problem) {
      notify(errorMessage(problem), "error");
    } finally {
      setBusyId(null);
    }
  }
  return (
    <section className="feed-section" id="stories">
      <div className="section-toolbar">
        <h2>
          {title}
          {data && <span className="count-badge">{data.count}</span>}
        </h2>
        <label className="sort-label">
          <span className="sr-only">Сортировка статей</span>
          <select
            aria-label="Сортировка статей"
            value={ordering}
            onChange={(event) => query("ordering", event.target.value)}
          >
            <option value="-published_date">Сначала новые</option>
            <option value="-like_count">Больше лайков</option>
            <option value="-views_count">Больше просмотров</option>
            <option value="published_date">Сначала старые</option>
          </select>
        </label>
      </div>
      {loading ? (
        <Skeleton />
      ) : error ? (
        <ErrorState error={error} retry={refetch} />
      ) : !data?.results.length ? (
        <EmptyState
          title={emptyTitle || "Историй пока нет"}
          description={
            emptyDescription ||
            "Попробуйте другую тему или загляните чуть позже."
          }
          action={
            manage && (
              <Link className="button" to="/articles/new">
                <PenLine size={17} />
                Написать статью
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="article-list">
            {data.results.map((article, index) => (
              <ArticleCard
                key={article.id}
                article={article}
                featured={featured && page === 1 && index === 0}
                manage={manage}
                busy={busyId === article.id}
                onPublication={publish}
                onDelete={(item) => {
                  setDeleteError(null);
                  setDeleteTarget(item);
                }}
              />
            ))}
          </div>
          <Pagination
            data={data}
            page={page}
            onPage={(value) => query("page", value)}
          />
        </>
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Удалить статью?"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={remove}
        busy={busyId !== null}
        error={deleteError}
      >
        «{deleteTarget?.title}» и все её комментарии будут удалены. Это действие
        нельзя отменить.
      </ConfirmDialog>
    </section>
  );
}
