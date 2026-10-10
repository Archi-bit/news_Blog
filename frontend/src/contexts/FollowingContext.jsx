import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import axios from "axios";
import { api, listAll } from "../api/client";
import { useAuth } from "./AuthContext";
const FollowingContext = createContext(null);
export function FollowingProvider({ children }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const id = user?.id;
  const retry = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    setFollowing(null);
    setError(null);
    if (!id) return;
    const controller = new AbortController();
    listAll(`users/${id}/following/`, { signal: controller.signal })
      .then(setFollowing)
      .catch((problem) => {
        if (!axios.isCancel(problem)) setError(problem);
      });
    return () => controller.abort();
  }, [id, version]);
  async function toggle(target) {
    if (!following) throw new Error("Подписки ещё не загружены.");
    const exists = following.some((item) => item.id === target.id);
    const { data } = await api.request({
      url: `users/${target.id}/follow/`,
      method: exists ? "delete" : "post",
    });
    setFollowing((items) =>
      data.is_following
        ? [
            ...(items || []).filter((item) => item.id !== target.id),
            { ...target, followers_count: data.followers_count },
          ]
        : (items || []).filter((item) => item.id !== target.id),
    );
    return data;
  }
  return (
    <FollowingContext.Provider value={{ following, error, retry, toggle }}>
      {children}
    </FollowingContext.Provider>
  );
}
export const useFollowing = () => useContext(FollowingContext);
