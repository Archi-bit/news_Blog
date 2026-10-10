import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CatalogProvider } from "./contexts/CatalogContext";
import { FollowingProvider } from "./contexts/FollowingContext";
import { ToastProvider } from "./contexts/ToastContext";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { HomePage } from "./pages/HomePage";
import { AuthPage } from "./pages/AuthPage";
import {
  CategoriesPage,
  CategoryPage,
  SearchPage,
  MyArticlesPage,
  NotFoundPage,
} from "./pages/BrowsePages";
import { ArticlePage } from "./pages/ArticlePage";
import {
  ProfilePage,
  EditProfilePage,
  FollowingPage,
} from "./pages/ProfilePages";
import { EditorPage } from "./pages/EditorPage";
export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CatalogProvider>
            <FollowingProvider>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<HomePage />} />
                  <Route path="login" element={<AuthPage />} />
                  <Route path="register" element={<AuthPage register />} />
                  <Route path="categories" element={<CategoriesPage />} />
                  <Route path="categories/:slug" element={<CategoryPage />} />
                  <Route path="search" element={<SearchPage />} />
                  <Route path="articles/:id" element={<ArticlePage />} />
                  <Route path="users/:id" element={<ProfilePage />} />
                  <Route element={<ProtectedRoute />}>
                    <Route path="articles/new" element={<EditorPage />} />
                    <Route path="articles/:id/edit" element={<EditorPage />} />
                    <Route path="my-articles" element={<MyArticlesPage />} />
                    <Route path="drafts" element={<MyArticlesPage drafts />} />
                    <Route path="profile/edit" element={<EditProfilePage />} />
                    <Route path="following" element={<FollowingPage />} />
                  </Route>
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </FollowingProvider>
          </CatalogProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
