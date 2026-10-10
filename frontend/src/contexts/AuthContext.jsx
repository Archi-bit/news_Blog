import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  api,
  refreshAccess,
  loginRequest,
  logoutRequest,
  onSessionExpired,
} from "../api/client";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);
  const restore = useCallback(async () => {
    setLoading(true);
    setSessionError(null);
    try {
      await refreshAccess();
      setUser((await api.get("users/me/")).data);
    } catch (error) {
      if (error.response?.status !== 401) setSessionError(error);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    restore();
    return onSessionExpired(() => setUser(null));
  }, [restore]);
  async function login(values) {
    const profile = await loginRequest(values);
    setUser(profile);
    setSessionError(null);
    return profile;
  }
  async function logout() {
    await logoutRequest();
    setUser(null);
  }
  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, sessionError, restore, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
