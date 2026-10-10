import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Eye, PenLine, ImagePlus } from "lucide-react";
import { api, errorFields, errorMessage, mediaUrl } from "../api/client";
import { useResource } from "../hooks/useResource";
import { useAuth } from "../contexts/AuthContext";
import { useCatalog } from "../contexts/CatalogContext";
import { useToast } from "../contexts/ToastContext";
import { ErrorState, Field, Skeleton } from "../components/UI";
export function EditorPage() {
  const { id } = useParams();
  const resource = useResource(id ? `articles/${id}/` : null);
  const { user } = useAuth();
  if (id && resource.loading) return <Skeleton />;
  if (resource.error)
    return <ErrorState error={resource.error} retry={resource.refetch} />;
  if (id && !resource.data) return null;
  if (id && resource.data.author.id !== user.id && !user.is_staff)
    return (
      <div className="form-alert" role="alert">
        Редактировать статью может её автор или администратор.
      </div>
    );
  return <ArticleEditor key={id || "new"} original={resource.data} />;
}
function ArticleEditor({ original }) {
  const {
    categories,
    tags,
    loading,
    error: catalogError,
    retry,
  } = useCatalog();
  const navigate = useNavigate();
  const notify = useToast();
  const [values, setValues] = useState({
    title: original?.title || "",
    excerpt: original?.excerpt || "",
    content: original?.content || "",
    category: original?.category || "",
    tags: original?.tags || [],
  });
  const [file, setFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const fields = errorFields(error);
  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    function guard(event) {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  function change(event) {
    setDirty(true);
    setValues((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }
  function tagChange(id) {
    setDirty(true);
    setValues((current) => ({
      ...current,
      tags: current.tags.includes(id)
        ? current.tags.filter((value) => value !== id)
        : [...current.tags, id],
    }));
  }
  async function save(event) {
    event.preventDefault();
    const intent = event.nativeEvent.submitter?.value || "draft";
    setBusy(true);
    setError(null);
    const payload = new FormData();
    ["title", "excerpt", "content", "category"].forEach((name) =>
      payload.append(name, values[name]),
    );
    values.tags.forEach((tag) => payload.append("tags", tag));
    payload.append("is_published", String(intent === "publish"));
    if (file) payload.append("thumbnail", file);
    else if (removeImage) payload.append("thumbnail", "");
    try {
      let data;
      if (file || removeImage) {
        // PUT передаёт полное состояние формы и очищает пустой список тегов в multipart.
        data = (
          await api.request({
            url: original ? `articles/${original.id}/` : "articles/",
            method: original ? "put" : "post",
            data: payload,
          })
        ).data;
      } else {
        data = (
          await api.request({
            url: original ? `articles/${original.id}/` : "articles/",
            method: original ? "patch" : "post",
            data: {
              ...values,
              category: Number(values.category),
              is_published: intent === "publish",
            },
          })
        ).data;
      }
      setDirty(false);
      notify(
        intent === "publish" ? "История опубликована" : "Черновик сохранён",
      );
      navigate(`/articles/${data.id}`);
    } catch (problem) {
      setError(problem);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Skeleton />;
  if (catalogError) return <ErrorState error={catalogError} retry={retry} />;
  const image =
    previewUrl ||
    (!removeImage && original?.thumbnail ? mediaUrl(original.thumbnail) : "");
  return (
    <div className="editor-page">
      <div className="editor-topbar">
        <Link className="back-link" to="/my-articles">
          <ArrowLeft size={16} />
          Мои истории
        </Link>
        <div className="editor-mode">
          <button
            className={!preview ? "active" : ""}
            onClick={() => setPreview(false)}
          >
            <PenLine size={15} />
            Редактор
          </button>
          <button
            className={preview ? "active" : ""}
            onClick={() => setPreview(true)}
          >
            <Eye size={15} />
            Предпросмотр
          </button>
        </div>
      </div>
      <div className="editor-heading">
        <span className="eyebrow">
          {original ? "Продолжите свою историю" : "Всё начинается с идеи"}
        </span>
        <h1>{original ? "Редактировать статью" : "Напишите что-то важное."}</h1>
        <p>Ваш опыт может стать чьим-то открытием.</p>
      </div>
      <form onSubmit={save}>
        {error && (
          <div className="form-alert" role="alert">
            {errorMessage(error)}
          </div>
        )}
        {preview ? (
          <article className="editor-preview">
            <span className="eyebrow">Предпросмотр</span>
            <h1>{values.title || "Заголовок вашей истории"}</h1>
            <p className="reading-excerpt">{values.excerpt}</p>
            {image && (
              <img
                className="editor-preview-image"
                src={image}
                alt="Обложка статьи"
              />
            )}
            <div className="reading-body">
              {(values.content || "Здесь появится ваша история.")
                .split(/\n\s*\n/)
                .map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
            </div>
            <button
              className="button button-outline"
              type="button"
              onClick={() => setPreview(false)}
            >
              Вернуться к редактированию
            </button>
          </article>
        ) : (
          <div className="editor-grid">
            <div className="editor-main">
              <Field label="Заголовок" name="title" error={fields.title}>
                <input
                  className="title-input"
                  id="title"
                  name="title"
                  required
                  maxLength={250}
                  placeholder="О чём ваша история?"
                  value={values.title}
                  onChange={change}
                  disabled={busy}
                />
              </Field>
              <Field
                label="Краткое описание"
                name="excerpt"
                error={fields.excerpt}
                hint="Пара предложений, которые заинтересуют читателя."
              >
                <textarea
                  id="excerpt"
                  name="excerpt"
                  maxLength={1000}
                  rows={3}
                  placeholder="Самое интересное — в нескольких словах"
                  value={values.excerpt}
                  onChange={change}
                  disabled={busy}
                />
              </Field>
              <Field
                label="Ваша история"
                name="content"
                error={fields.content}
                hint="Разделяйте абзацы пустой строкой. Текст публикуется без HTML."
              >
                <textarea
                  className="content-input"
                  id="content"
                  name="content"
                  required
                  rows={16}
                  placeholder="Начните с того, что вас вдохновляет…"
                  value={values.content}
                  onChange={change}
                  disabled={busy}
                />
              </Field>
            </div>
            <aside className="editor-settings">
              <h3>Детали публикации</h3>
              <Field label="Тема" name="category" error={fields.category}>
                <select
                  id="category"
                  name="category"
                  required
                  value={values.category}
                  onChange={change}
                  disabled={busy}
                >
                  <option value="">Выберите тему</option>
                  {categories.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              <fieldset className="tag-picker" disabled={busy}>
                <legend>Теги</legend>
                <p>Помогут найти вашу статью.</p>
                <div>
                  {tags.map((tag) => (
                    <label
                      key={tag.id}
                      className={values.tags.includes(tag.id) ? "selected" : ""}
                    >
                      <input
                        type="checkbox"
                        checked={values.tags.includes(tag.id)}
                        onChange={() => tagChange(tag.id)}
                      />
                      {tag.name}
                    </label>
                  ))}
                </div>
                {fields.tags && (
                  <p className="field-error">{fields.tags.join(" ")}</p>
                )}
              </fieldset>
              <Field
                label="Обложка"
                name="thumbnail"
                error={fields.thumbnail}
                hint="PNG, JPEG или WebP, до 5 МБ."
              >
                <div className="cover-upload">
                  {image ? (
                    <img src={image} alt="Обложка статьи" />
                  ) : (
                    <ImagePlus size={27} />
                  )}
                  <input
                    id="thumbnail"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={busy}
                    onChange={(event) => {
                      setFile(event.target.files[0] || null);
                      setRemoveImage(false);
                      setDirty(true);
                    }}
                  />
                </div>
              </Field>
              {original?.thumbnail && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={removeImage}
                    disabled={busy}
                    onChange={(event) => {
                      setRemoveImage(event.target.checked);
                      setFile(null);
                      setDirty(true);
                    }}
                  />
                  Удалить обложку
                </label>
              )}
              <p className="editor-note">
                Не готовы поделиться?
                <br />
                Сохраните черновик и вернитесь к нему позже.
              </p>
            </aside>
          </div>
        )}
        <div className="editor-bottom">
          <span>
            {dirty
              ? "Есть несохранённые изменения"
              : original
                ? "Статья загружена"
                : "Новая история"}
          </span>
          <div>
            <button
              type="submit"
              value="draft"
              className="button button-outline"
              disabled={busy || !categories.length}
            >
              {busy ? "Сохраняем…" : "Сохранить черновик"}
            </button>
            <button
              type="submit"
              value="publish"
              className="button"
              disabled={busy || !categories.length}
            >
              {busy ? "Сохраняем…" : "Опубликовать"}
              <ArrowUpRight size={16} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
