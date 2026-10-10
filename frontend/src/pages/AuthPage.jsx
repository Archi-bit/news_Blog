import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, Eye, EyeOff } from "lucide-react";
import { api, errorFields, errorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Field, Skeleton } from "../components/UI";
export function AuthPage({ register = false }) {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const notify = useToast();
  const [params] = useSearchParams();
  const requested = params.get("next") || "/";
  const next =
    requested.startsWith("/") &&
    !requested.startsWith("//") &&
    !/^\/(login|register)/.test(requested)
      ? requested
      : "/";
  const [values, setValues] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmError, setConfirmError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const fields = errorFields(error);
  if (loading) return <Skeleton count={1} />;
  if (user) return <Navigate to={next} replace />;
  function change(event) {
    setValues((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }
  async function submit(event) {
    event.preventDefault();
    setError(null);
    setConfirmError("");
    if (register && values.password !== values.confirm) {
      setConfirmError("Пароли не совпадают.");
      return;
    }
    setBusy(true);
    try {
      if (register) {
        await api.post("auth/register/", {
          username: values.username,
          email: values.email,
          password: values.password,
        });
        notify("Аккаунт создан. Войдите с вашим логином и паролем.");
        navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
      } else {
        await login({ username: values.username, password: values.password });
        notify("Рады видеть вас снова");
        navigate(next, { replace: true });
      }
    } catch (problem) {
      setError(problem);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <span className="eyebrow">Ваше место среди историй</span>
        <BookOpen size={42} strokeWidth={1} />
        <h1>
          Хорошие идеи
          <br />
          заслуживают
          <br />
          <em>быть услышанными.</em>
        </h1>
        <p>
          Читайте то, что интересно.
          <br />
          Пишите о том, что важно.
          <br />
          Находите тех, кто вас понимает.
        </p>
        <span className="auth-story-footer">
          News Blog · Сообщество любопытных
        </span>
      </aside>
      <section className="auth-form-panel">
        <span className="eyebrow">
          {register ? "Начните свою историю" : "С возвращением"}
        </span>
        <h2>{register ? "Создать аккаунт" : "Войти в News Blog"}</h2>
        <p>
          {register
            ? "Пять минут — и вы часть нашего сообщества."
            : "Ваши истории и любимые авторы уже ждут."}
        </p>
        <form onSubmit={submit}>
          {error && (
            <div className="form-alert" role="alert">
              {errorMessage(error)}
            </div>
          )}
          <Field
            label="Имя пользователя"
            name="username"
            error={fields.username}
          >
            <input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              required
              maxLength={150}
              value={values.username}
              onChange={change}
              disabled={busy}
              aria-invalid={Boolean(fields.username)}
              placeholder="Ваш логин"
            />
          </Field>
          {register && (
            <Field label="Электронная почта" name="email" error={fields.email}>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={values.email}
                onChange={change}
                disabled={busy}
                placeholder="you@example.com"
              />
            </Field>
          )}
          <Field
            label="Пароль"
            name="password"
            error={fields.password}
            hint={
              register
                ? "Не менее 8 символов. Используйте буквы, цифры и знаки."
                : undefined
            }
          >
            <div className="password-field">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={register ? "new-password" : "current-password"}
                required
                minLength={register ? 8 : undefined}
                maxLength={128}
                value={values.password}
                onChange={change}
                disabled={busy}
                aria-invalid={Boolean(fields.password)}
                placeholder="Ваш пароль"
              />
              <button
                type="button"
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          {register && (
            <Field label="Повторите пароль" name="confirm" error={confirmError}>
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={values.confirm}
                onChange={change}
                disabled={busy}
              />
            </Field>
          )}
          <button className="button auth-submit" type="submit" disabled={busy}>
            {busy ? "Подождите…" : register ? "Создать аккаунт" : "Войти"}
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="auth-switch">
          {register ? "Уже есть аккаунт?" : "Первый раз здесь?"}{" "}
          <Link
            to={`/${register ? "login" : "register"}?next=${encodeURIComponent(next)}`}
          >
            {register ? "Войти" : "Присоединиться"}
          </Link>
        </div>
      </section>
    </div>
  );
}
