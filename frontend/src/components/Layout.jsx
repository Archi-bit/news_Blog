import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowUpRight,
  Search,
  PenLine,
  Menu,
  X,
  LogOut,
  BookOpen,
  FileText,
  Users,
  UserRound,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Avatar, displayName } from "./UI";
import { errorMessage } from "../api/client";
export function Layout() {
  const { user, loading, logout, sessionError, restore } = useAuth();
  const notify = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    setMobileOpen(false);
    document.querySelector(".user-menu")?.removeAttribute("open");
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  useEffect(() => {
    const titles = {
      "/": "Место для хороших идей",
      "/login": "Вход",
      "/register": "Регистрация",
      "/categories": "Темы",
      "/my-articles": "Мои статьи",
      "/drafts": "Черновики",
      "/following": "Подписки",
      "/search": "Поиск",
    };
    document.title = `${titles[location.pathname] || "Истории и авторы"} — News Blog`;
  }, [location.pathname]);
  async function signOut() {
    setLoggingOut(true);
    try {
      await logout();
      notify("Вы вышли из аккаунта");
      navigate("/");
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setLoggingOut(false);
    }
  }
  return (
    <>
      <a className="skip-link" href="#main-content">
        Перейти к содержимому
      </a>
      <div className="utility-bar">
        <div className="container">
          <span>Независимые мысли. Общие интересы.</span>
          <span className="utility-date">
            {new Intl.DateTimeFormat("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date())}
          </span>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="News Blog — главная">
            news<span>blog</span>
            <i />
          </Link>
          <nav className="desktop-nav" aria-label="Основная навигация">
            <NavLink to="/" end>
              Лента
            </NavLink>
            <NavLink to="/categories">Темы</NavLink>
            {user && <NavLink to="/following">Подписки</NavLink>}
          </nav>
          <form
            className="header-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(`/search?q=${encodeURIComponent(search.trim())}`);
            }}
          >
            <Search size={17} />
            <input
              aria-label="Поиск статей"
              placeholder="Найти историю"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button className="sr-only" type="submit">
              Найти
            </button>
          </form>
          <div className="header-actions">
            <Link
              className="write-link"
              aria-label="Написать статью"
              to={user ? "/articles/new" : "/login?next=%2Farticles%2Fnew"}
            >
              <PenLine size={17} />
              <span>Написать</span>
            </Link>
            {loading ? (
              <span className="skeleton header-avatar-skeleton" />
            ) : user ? (
              <details className="user-menu">
                <summary aria-label="Меню профиля">
                  <Avatar user={user} />
                  <span className="user-menu-name">
                    {user.first_name || user.username}
                  </span>
                </summary>
                <div className="dropdown">
                  <div className="dropdown-name">
                    {displayName(user)}
                    <small>@{user.username}</small>
                  </div>
                  <Link to={`/users/${user.id}`}>
                    <UserRound size={16} />
                    Мой профиль
                  </Link>
                  <Link to="/my-articles">
                    <BookOpen size={16} />
                    Мои статьи
                  </Link>
                  <Link to="/drafts">
                    <FileText size={16} />
                    Черновики
                  </Link>
                  <Link to="/following">
                    <Users size={16} />
                    Подписки
                  </Link>
                  <button disabled={loggingOut} onClick={signOut}>
                    <LogOut size={16} />
                    {loggingOut ? "Выход…" : "Выйти"}
                  </button>
                </div>
              </details>
            ) : (
              <Link className="button button-small" to="/login">
                Войти <ArrowUpRight size={15} />
              </Link>
            )}
            <button
              className="mobile-toggle"
              aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <nav
            id="mobile-nav"
            className="mobile-nav"
            aria-label="Мобильная навигация"
          >
            <Link to="/">Лента</Link>
            <Link to="/categories">Темы</Link>
            <Link to="/search">Поиск</Link>
            {user && (
              <>
                <Link to="/my-articles">Мои статьи</Link>
                <Link to="/drafts">Черновики</Link>
                <Link to="/following">Подписки</Link>
              </>
            )}
          </nav>
        )}
      </header>
      {sessionError && (
        <div className="session-banner" role="alert">
          Не удалось восстановить сессию.{" "}
          <button onClick={restore}>Попробовать снова</button>
        </div>
      )}
      <main id="main-content" className="container main-content">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <Link className="brand" to="/">
            news<span>blog</span>
            <i />
          </Link>
          <p>Хорошие истории начинаются с любопытства.</p>
          <nav aria-label="Навигация в подвале">
            <Link to="/categories">Все темы</Link>
            <Link to={user ? "/articles/new" : "/register"}>
              Стать автором <ArrowUpRight size={14} />
            </Link>
          </nav>
          <small>© {new Date().getFullYear()} News Blog</small>
        </div>
      </footer>
    </>
  );
}
