import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useFollowing } from "../contexts/FollowingContext";
import { useToast } from "../contexts/ToastContext";
import { errorMessage } from "../api/client";
export function FollowButton({ target, onChange }) {
  const { user } = useAuth();
  const { following, error, retry, toggle } = useFollowing();
  const notify = useToast();
  const [busy, setBusy] = useState(false);
  if (user?.id === target.id) return null;
  if (!user)
    return (
      <Link
        className="button button-small"
        to={`/login?next=${encodeURIComponent(`/users/${target.id}`)}`}
      >
        <Plus size={16} />
        Подписаться
      </Link>
    );
  if (error)
    return (
      <button className="button button-outline button-small" onClick={retry}>
        Повторить загрузку подписок
      </button>
    );
  const isFollowing = following?.some((item) => item.id === target.id);
  async function change() {
    setBusy(true);
    try {
      const result = await toggle(target);
      onChange?.(result);
      notify(
        result.is_following ? "Вы подписались на автора" : "Подписка отменена",
      );
    } catch (problem) {
      notify(errorMessage(problem), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      className={`button button-small ${isFollowing ? "button-outline" : ""}`}
      disabled={busy || !following}
      onClick={change}
    >
      {isFollowing ? <Check size={16} /> : <Plus size={16} />}{" "}
      {busy
        ? "Сохраняем…"
        : !following
          ? "Загрузка…"
          : isFollowing
            ? "Вы подписаны"
            : "Подписаться"}
    </button>
  );
}
