import { useParams, useSearchParams, Link } from "react-router-dom";
import {
  Search,
  ArrowUpRight,
  FlaskConical,
  Cpu,
  GraduationCap,
  Briefcase,
  Trophy,
  Folder,
} from "lucide-react";
import { useCatalog } from "../contexts/CatalogContext";
import { useResource } from "../hooks/useResource";
import { ArticleFeed } from "../components/ArticleFeed";
import { Sidebar } from "../components/Sidebar";
import {
  EmptyState,
  ErrorState,
  PageHeading,
  Skeleton,
} from "../components/UI";
const categoryIcons = {
  Технологии: Cpu,
  Спорт: Trophy,
  Наука: FlaskConical,
  Бизнес: Briefcase,
  Образование: GraduationCap,
};
const descriptions = {
  Технологии:
    "Инструменты, которые меняют привычное. И люди, которые их создают.",
  Спорт: "Движение, характер и маленькие победы каждый день.",
  Наука: "Задаём вопросы, исследуем мир и ищем неожиданные ответы.",
  Бизнес: "От первой идеи до работающего дела. Опыт без лишних слов.",
  Образование: "Учиться новому — значит открывать больше возможностей.",
};
export function CategoriesPage() {
  const { categories, loading, error, retry } = useCatalog();
  return (
    <>
      <PageHeading
        eyebrow="Следуйте за любопытством"
        title="О чём вам интересно читать?"
        description="Выберите тему. Найдите новые идеи. Посмотрите на привычное иначе."
      />
      {loading ? (
        <Skeleton />
      ) : error ? (
        <ErrorState error={error} retry={retry} />
      ) : !categories.length ? (
        <EmptyState
          title="Тем пока нет"
          description="Администратор скоро добавит первые категории."
        />
      ) : (
        <div className="category-grid">
          {categories.map((category, index) => {
            const Icon = categoryIcons[category.name] || Folder;
            return (
              <Link
                className={`category-tile tone-${index % 5}`}
                key={category.id}
                to={`/categories/${category.slug}`}
              >
                <div className="category-tile-top">
                  <span className="category-icon">
                    <Icon size={30} strokeWidth={1.4} />
                  </span>
                  <ArrowUpRight size={24} />
                </div>
                <h2>{category.name}</h2>
                <p>
                  {descriptions[category.name] ||
                    "Истории и взгляды, которые стоит открыть для себя."}
                </p>
                <span className="category-tile-link">
                  Открыть истории <ArrowUpRight size={15} />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
export function CategoryPage() {
  const { slug } = useParams();
  const resource = useResource(`categories/${encodeURIComponent(slug)}/`);
  if (resource.loading) return <Skeleton />;
  if (resource.error)
    return <ErrorState error={resource.error} retry={resource.refetch} />;
  return (
    <>
      <PageHeading
        eyebrow="Тема для вдохновения"
        title={resource.data.name}
        description={
          descriptions[resource.data.name] ||
          "Истории, опыт и свежие взгляды авторов."
        }
      />
      <div className="content-grid">
        <ArticleFeed
          params={{ category: slug, is_published: true }}
          title="Истории по теме"
        />
        <Sidebar />
      </div>
    </>
  );
}
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const tag = params.get("tag") || "";
  const category = params.get("category") || "";
  const { categories, tags } = useCatalog();
  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setParams((current) => {
      const next = new URLSearchParams(current);
      const query = form.get("q").trim();
      if (query) next.set("q", query);
      else next.delete("q");
      next.delete("page");
      return next;
    });
  }
  function filter(key, value) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      return next;
    });
  }
  return (
    <>
      <PageHeading
        eyebrow="Найдите то самое"
        title="Каждая история — новое открытие"
        description="Ищите по названию, описанию или содержанию статьи."
      />
      <form className="search-page-form" onSubmit={submit}>
        <Search size={23} />
        <input
          key={q}
          name="q"
          aria-label="Поисковый запрос"
          defaultValue={q}
          placeholder="Что вам интересно?"
        />
        <button className="button" type="submit">
          Найти
        </button>
      </form>
      <div className="search-filters">
        <label>
          Тема
          <select
            value={category}
            onChange={(event) => filter("category", event.target.value)}
          >
            <option value="">Все темы</option>
            {categories.map((item) => (
              <option value={item.slug} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Тег
          <select
            value={tag}
            onChange={(event) => filter("tag", event.target.value)}
          >
            <option value="">Все теги</option>
            {tags.map((item) => (
              <option value={item.slug} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {(q || category || tag) && (
          <button className="text-link" onClick={() => setParams({})}>
            Сбросить фильтры
          </button>
        )}
      </div>
      <ArticleFeed
        title={q ? `Результаты: «${q}»` : "Найденные истории"}
        params={{ search: q, category, tags: tag, is_published: true }}
        emptyTitle="Ничего не нашлось"
        emptyDescription="Попробуйте другой запрос или уберите часть фильтров."
      />
    </>
  );
}
export function MyArticlesPage({ drafts = false }) {
  return (
    <>
      <PageHeading
        eyebrow="Ваше пространство"
        title={drafts ? "Идеи в работе" : "Мои истории"}
        description={
          drafts
            ? "Каждая хорошая история начинается с первого наброска."
            : "Все ваши публикации и черновики в одном месте."
        }
        action={
          <Link className="button" to="/articles/new">
            Написать статью <ArrowUpRight size={17} />
          </Link>
        }
      />
      <div className="workspace-tabs">
        <Link className={!drafts ? "active" : ""} to="/my-articles">
          Все статьи
        </Link>
        <Link className={drafts ? "active" : ""} to="/drafts">
          Черновики
        </Link>
      </div>
      <ArticleFeed
        key={drafts ? "drafts" : "my"}
        path={`articles/${drafts ? "drafts" : "my"}/`}
        title={drafts ? "Ваши черновики" : "Ваши статьи"}
        manage
        emptyTitle={
          drafts ? "Все идеи уже опубликованы" : "Ваша первая история впереди"
        }
        emptyDescription="Напишите о том, что знаете, любите или хотите исследовать."
      />
    </>
  );
}
export function NotFoundPage() {
  return (
    <div className="not-found">
      <span className="eyebrow">Поворот не туда</span>
      <div className="not-found-number">
        404<span>✳</span>
      </div>
      <h1>Эта история ещё не написана.</h1>
      <p>Такой страницы нет. Зато в ленте есть много интересного.</p>
      <Link className="button" to="/">
        Вернуться в ленту <ArrowUpRight size={16} />
      </Link>
    </div>
  );
}
