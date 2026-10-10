import { Link } from "react-router-dom";
import { ArrowDown, ArrowUpRight, MoveUpRight } from "lucide-react";
import { useCatalog } from "../contexts/CatalogContext";
import { useAuth } from "../contexts/AuthContext";
import { ArticleFeed } from "../components/ArticleFeed";
import { Sidebar } from "../components/Sidebar";
export function HomePage() {
  const { categories } = useCatalog();
  const { user } = useAuth();
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="tiny-dot" /> Для тех, кому интересно
          </span>
          <h1>
            Мир полон историй.
            <br />
            <em>Найдите свою.</em>
          </h1>
          <p>
            Свежие мысли, неожиданные открытия и люди,
            <br className="desktop-break" /> которым есть что рассказать.
            Читайте. Вдохновляйтесь. Делитесь.
          </p>
          <div className="hero-actions">
            <a href="#stories" className="button">
              Начать читать <ArrowDown size={16} />
            </a>
            <Link
              to={user ? "/articles/new" : "/register"}
              className="text-link"
            >
              Написать историю <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="art-sun" />
          <div className="art-paper paper-one">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="art-paper paper-two">
            <MoveUpRight size={58} />
          </div>
          <span className="art-caption">
            Есть идея?
            <br />
            Дайте ей голос.
          </span>
          <span className="art-spark">✳</span>
        </div>
        <div className="hero-bottom">
          <span>Слова, которые имеют значение.</span>
          <span>
            Ваше пространство для мыслей <span>↗</span>
          </span>
        </div>
      </section>
      <nav className="topic-tabs" aria-label="Темы статей">
        <Link className="active" to="/">
          Для вас
        </Link>
        {categories.map((category) => (
          <Link key={category.id} to={`/categories/${category.slug}`}>
            {category.name}
          </Link>
        ))}
        <Link className="all-topics-link" to="/categories">
          Все темы <ArrowUpRight size={14} />
        </Link>
      </nav>
      <div className="content-grid">
        <ArticleFeed featured params={{ is_published: true }} />
        <Sidebar />
      </div>
    </>
  );
}
