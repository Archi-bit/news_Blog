import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import axios from "axios";
import { listAll } from "../api/client";
const CatalogContext = createContext(null);
export function CatalogProvider({ children }) {
  const [catalog, setCatalog] = useState({
    categories: [],
    tags: [],
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);
  const retry = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setCatalog((value) => ({ ...value, loading: true, error: null }));
    Promise.all([
      listAll("categories/", { signal: controller.signal }),
      listAll("tags/", { signal: controller.signal }),
    ])
      .then(([categories, tags]) =>
        setCatalog({ categories, tags, loading: false, error: null }),
      )
      .catch((error) => {
        if (!axios.isCancel(error))
          setCatalog({ categories: [], tags: [], loading: false, error });
      });
    return () => controller.abort();
  }, [version]);
  return (
    <CatalogContext.Provider value={{ ...catalog, retry }}>
      {children}
    </CatalogContext.Provider>
  );
}
export const useCatalog = () => useContext(CatalogContext);
