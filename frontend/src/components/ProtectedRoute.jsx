import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ErrorState, Skeleton } from "./UI";
export function ProtectedRoute() {
  const { user, loading, sessionError, restore } = useAuth();
  const location = useLocation();
  if (loading) return <Skeleton count={2} />;
  if (sessionError && !user)
    return <ErrorState error={sessionError} retry={restore} />;
  return user ? (
    <Outlet />
  ) : (
    <Navigate
      to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
      replace
    />
  );
}
