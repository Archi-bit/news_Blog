import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { api } from "../api/client";
export function useResource(path, params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  ).toString();
  const url = path ? `${path}${query ? `?${query}` : ""}` : null;
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({
    data: null,
    loading: Boolean(path),
    error: null,
  });
  const refetch = useCallback(() => setVersion((value) => value + 1), []);
  const setData = useCallback(
    (update) =>
      setState((value) => ({
        ...value,
        data: typeof update === "function" ? update(value.data) : update,
      })),
    [],
  );
  useEffect(() => {
    if (!url) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const controller = new AbortController();
    setState({ data: null, loading: true, error: null });
    api
      .get(url, { signal: controller.signal })
      .then(({ data }) => setState({ data, loading: false, error: null }))
      .catch((error) => {
        if (!axios.isCancel(error))
          setState({ data: null, loading: false, error });
      });
    return () => controller.abort();
  }, [url, version]);
  return { ...state, refetch, setData };
}
