import { Link } from "react-router-dom";
import { ArrowUpRight, Sprout, Sparkles } from "lucide-react";
import { useCatalog } from "../contexts/CatalogContext";
import { useAuth } from "../contexts/AuthContext";
import { useResource } from "../hooks/useResource";
import { Avatar, displayName, TextLink, ErrorState } from "./UI";
export function Sidebar() {
  const { categories, tags, error, retry } = useCatalog();
  const { user } = useAuth();
  const popular = useResource("articles/", {
    ordering: "-like_count",
    is_published: true,
  });
  return (
    <aside className="sidebar">
      <section className="sidebar-section">
        <div className="sidebar-heading">
          <Sparkles size={16} />
          <h3>Находите своё</h3>
        </div>
        <p>Большие идеи начинаются с маленького интереса.</p>
        {error ? (
          <ErrorState error={error} retry={retry} />
        ) : (
          <div className="topic-cloud">
            {categories.map((category) => (
              <Link key={category.id} to={`/categories/${category.slug}`}>
                {category.name}
                <ArrowUpRight size={13} />
              </Link>
            ))}
          </div>
        )}
        <TextLink to="/categories">Посмотреть все темы</TextLink>
      </section>
      <section className="sidebar-section">
        <div className="sidebar-heading">
          <span className="tiny-dot" />
          <h3>Выбор читателей</h3>
        </div>
        {popular.error ? (
          <ErrorState error={popular.error} retry={popular.refetch} />
        ) : popular.loading ? (
          <p className="meta">Загружаем истории…</p>
        ) : (
          popular.data?.results.slice(0, 3).map((article, index) => (
            <article className="popular-story" key={article.id}>
              <span className="popular-number">0{index + 1}</span>
              <div>
                <Link
                  className="author-line"
                  to={`/users/${article.author.id}`}
                >
                  <Avatar user={article.author} />
                  <span>{displayName(article.author)}</span>
                </Link>
                <Link className="popular-title" to={`/articles/${article.id}`}>
                  {article.title}
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
      <section className="writer-invite">
        <Sprout size={27} />
        <h3>
          У каждой идеи
          <br />
          есть свой читатель.
        </h3>
        <p>
          Поделитесь тем, что знаете.
          <br />
          Мы поможем начать.
        </p>
        <Link
          className="button button-small"
          to={user ? "/articles/new" : "/register"}
        >
          Стать автором <ArrowUpRight size={15} />
        </Link>
      </section>
      {tags.length > 0 && (
        <section className="sidebar-section">
          <h3>В деталях</h3>
          <div className="tag-cloud">
            {tags.slice(0, 8).map((tag) => (
              <Link
                key={tag.id}
                to={`/search?tag=${encodeURIComponent(tag.slug)}`}
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        </section>
      )}
      <p className="sidebar-note">
        Читаем внимательно.
        <br />
        Делимся осмысленно.
      </p>
    </aside>
  );
}
