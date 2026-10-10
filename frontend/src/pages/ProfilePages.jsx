import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ArrowUpRight, PenLine, ExternalLink } from "lucide-react";
import { api, errorFields, errorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useResource } from "../hooks/useResource";
import { useToast } from "../contexts/ToastContext";
import { FollowButton } from "../components/FollowButton";
import { ArticleFeed } from "../components/ArticleFeed";
import {
  Avatar,
  displayName,
  EmptyState,
  ErrorState,
  Field,
  formatDate,
  PageHeading,
  Pagination,
  Skeleton,
} from "../components/UI";
function UserList({ path }) {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const resource = useResource(path, { page });
  if (resource.loading) return <Skeleton count={2} />;
  if (resource.error)
    return <ErrorState error={resource.error} retry={resource.refetch} />;
  return (
    <>
      {!resource.data.results.length ? (
        <EmptyState
          title="Здесь пока никого нет"
          description="Читайте истории и находите авторов, чьи мысли вам близки."
        />
      ) : (
        <div className="user-list">
          {resource.data.results.map((person) => (
            <div className="user-list-item" key={person.id}>
              <Link
                to={`/users/${person.id}`}
                aria-label={`Профиль ${displayName(person)}`}
              >
                <Avatar user={person} size="medium" />
              </Link>
              <div>
                <Link className="user-list-name" to={`/users/${person.id}`}>
                  {displayName(person)}
                </Link>
                <p>{person.bio || `@${person.username}`}</p>
                <small>{person.followers_count} подписчиков</small>
              </div>
              <FollowButton target={person} onChange={resource.refetch} />
            </div>
          ))}
        </div>
      )}
      <Pagination
        data={resource.data}
        page={page}
        onPage={(value) =>
          setParams((current) => {
            const next = new URLSearchParams(current);
            next.set("page", value);
            return next;
          })
        }
      />
    </>
  );
}
export function ProfilePage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const resource = useResource(`users/${id}/`);
  const [params, setParams] = useSearchParams();
  const tab = ["articles", "followers", "following"].includes(params.get("tab"))
    ? params.get("tab")
    : "articles";
  if (authLoading || resource.loading) return <Skeleton />;
  if (resource.error)
    return <ErrorState error={resource.error} retry={resource.refetch} />;
  const profile = resource.data;
  return (
    <div className="profile-page">
      <div className="profile-banner" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="profile-header">
        <Avatar user={profile} size="profile" />
        <div className="profile-header-actions">
          {user?.id === profile.id ? (
            <Link
              className="button button-outline button-small"
              to="/profile/edit"
            >
              <PenLine size={16} />
              Редактировать профиль
            </Link>
          ) : (
            <FollowButton
              target={profile}
              onChange={(data) =>
                resource.setData((current) => ({
                  ...current,
                  followers_count: data.followers_count,
                }))
              }
            />
          )}
        </div>
        <h1>{displayName(profile)}</h1>
        <p className="profile-handle">@{profile.username}</p>
        <p className="profile-bio">
          {profile.bio || "Здесь начинается история автора."}
        </p>
        <div className="profile-details">
          <button onClick={() => setParams({ tab: "followers" })}>
            <strong>{profile.followers_count}</strong> подписчиков
          </button>
          <span>С нами с {formatDate(profile.date_register)}</span>
          {profile.social_link && (
            <a
              href={profile.social_link}
              target="_blank"
              rel="noopener noreferrer"
            >
              Социальная сеть <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
      <nav className="workspace-tabs" aria-label="Разделы профиля">
        {[
          ["articles", "Истории"],
          ["followers", "Подписчики"],
          ["following", "Подписки"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => setParams({ tab: value })}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "articles" ? (
        <ArticleFeed key={id} params={{ author: id }} title="Истории автора" />
      ) : (
        <UserList key={`${id}-${tab}`} path={`users/${id}/${tab}/`} />
      )}
    </div>
  );
}
export function EditProfilePage() {
  const { user, setUser } = useAuth();
  const notify = useToast();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    bio: user.bio,
    social_link: user.social_link,
  });
  const [avatar, setAvatar] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fields = errorFields(error);
  function change(event) {
    setValues((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = new FormData();
      Object.entries(values).forEach(([name, value]) =>
        payload.append(name, value),
      );
      if (avatar) payload.append("avatar", avatar);
      else if (removeAvatar) payload.append("avatar", "");
      const { data } = await api.patch("users/me/", payload);
      setUser(data);
      notify("Профиль обновлён");
      navigate(`/users/${data.id}`);
    } catch (problem) {
      setError(problem);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="form-page">
      <PageHeading
        eyebrow="Пара слов о вас"
        title="Редактировать профиль"
        description="Помогите читателям узнать человека за историями."
      />
      <form className="profile-edit-form" onSubmit={save}>
        {error && (
          <div className="form-alert" role="alert">
            {errorMessage(error)}
          </div>
        )}
        <div className="avatar-edit">
          <Avatar
            user={removeAvatar ? { ...user, avatar: null } : user}
            size="large"
          />
          <div>
            <Field
              label="Фото профиля"
              name="avatar"
              error={fields.avatar}
              hint="PNG, JPEG или WebP, до 5 МБ."
            >
              <input
                id="avatar"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={(event) => {
                  setAvatar(event.target.files[0] || null);
                  setRemoveAvatar(false);
                }}
              />
            </Field>
            {avatar && <small>Выбрано: {avatar.name}</small>}
            {user.avatar && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={removeAvatar}
                  onChange={(event) => {
                    setRemoveAvatar(event.target.checked);
                    setAvatar(null);
                  }}
                  disabled={busy}
                />
                Удалить текущее фото
              </label>
            )}
          </div>
        </div>
        <div className="form-two-columns">
          {[
            ["first_name", "Имя"],
            ["last_name", "Фамилия"],
          ].map(([name, label]) => (
            <Field key={name} label={label} name={name} error={fields[name]}>
              <input
                id={name}
                name={name}
                value={values[name]}
                onChange={change}
                maxLength={150}
                disabled={busy}
              />
            </Field>
          ))}
        </div>
        <Field label="Электронная почта" name="email" error={fields.email}>
          <input
            id="email"
            name="email"
            type="email"
            value={values.email}
            onChange={change}
            disabled={busy}
          />
        </Field>
        <Field label="О себе" name="bio" error={fields.bio}>
          <textarea
            id="bio"
            name="bio"
            value={values.bio}
            onChange={change}
            maxLength={5000}
            rows={5}
            placeholder="О чём вы пишете и что вас вдохновляет?"
            disabled={busy}
          />
        </Field>
        <Field
          label="Ссылка на социальную сеть"
          name="social_link"
          error={fields.social_link}
        >
          <input
            id="social_link"
            name="social_link"
            type="url"
            value={values.social_link}
            onChange={change}
            placeholder="https://"
            disabled={busy}
          />
        </Field>
        <div className="form-actions">
          <Link className="button button-outline" to={`/users/${user.id}`}>
            Отмена
          </Link>
          <button className="button" type="submit" disabled={busy}>
            {busy ? "Сохраняем…" : "Сохранить профиль"}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
export function FollowingPage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeading
        eyebrow="Ваш круг интересов"
        title="Авторы, которых вы читаете"
        description="Сохраняйте связь с людьми, чьи идеи вам близки."
      />
      <UserList path={`users/${user.id}/following/`} />
    </>
  );
}
