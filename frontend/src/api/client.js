import axios from "axios";

// JWT живёт только в памяти. Refresh-cookie недоступна JavaScript.
let accessToken = null;
let refreshPromise = null;
let sessionGeneration = 0;
const sessionListeners = new Set();
const transport = axios.create({
  baseURL: "/api/v1/",
  withCredentials: true,
  timeout: 20000,
});
export const api = axios.create({
  baseURL: "/api/v1/",
  withCredentials: true,
  timeout: 20000,
});

export function clearSession() {
  sessionGeneration += 1;
  accessToken = null;
  sessionListeners.forEach((listener) => listener());
}
export function onSessionExpired(listener) {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}
async function csrfHeaders() {
  const { data } = await transport.get("auth/csrf/");
  return { "X-CSRFToken": data.csrfToken };
}
export function refreshAccess() {
  if (!refreshPromise) {
    const generation = sessionGeneration;
    refreshPromise = (async () => {
      const { data } = await transport.post(
        "auth/refresh/",
        {},
        { headers: await csrfHeaders() },
      );
      if (generation !== sessionGeneration)
        throw new Error("Сессия изменилась. Повторите вход.");
      accessToken = data.access;
      return accessToken;
    })()
      .catch((error) => {
        if (error.response?.status === 401 && generation === sessionGeneration)
          clearSession();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}
export async function loginRequest(credentials) {
  const { data } = await transport.post("auth/login/", credentials, {
    headers: await csrfHeaders(),
  });
  sessionGeneration += 1;
  accessToken = data.access;
  return (await api.get("users/me/")).data;
}
export async function logoutRequest() {
  await transport.post("auth/logout/", {}, { headers: await csrfHeaders() });
  clearSession();
}
api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (
      error.response?.status === 401 &&
      accessToken &&
      config &&
      !config._retry
    ) {
      config._retry = true;
      await refreshAccess();
      return api(config);
    }
    throw error;
  },
);
export async function listAll(path, options = {}) {
  const results = [];
  let page = 1;
  while (true) {
    const { data } = await api.get(path, {
      ...options,
      params: { ...options.params, page },
    });
    results.push(...data.results);
    if (!data.next) return results;
    page += 1;
  }
}
export function errorFields(error) {
  const details = error?.response?.data?.error?.details;
  return details && typeof details === "object" && !Array.isArray(details)
    ? details
    : {};
}
export function errorMessage(error) {
  if (!error?.response)
    return error?.code === "ECONNABORTED"
      ? "Сервер отвечает слишком долго. Попробуйте ещё раз."
      : "Не удалось связаться с сервером. Проверьте соединение и повторите попытку.";
  if (error.response.status === 404)
    return "Страница не найдена или у вас нет доступа к ней.";
  if (error.response.status === 401)
    return (
      error.response.data?.error?.details?.detail ||
      "Сессия завершена. Войдите в аккаунт ещё раз."
    );
  if (error.response.status === 429)
    return "Слишком много запросов. Подождите немного и повторите попытку.";
  const details = error.response.data?.error?.details;
  if (Array.isArray(details)) return details.join(" ");
  if (typeof details === "string") return details;
  if (details?.detail) return String(details.detail);
  if (details?.non_field_errors) return details.non_field_errors.join(" ");
  if (details && typeof details === "object")
    return Object.values(details).flat().join(" ");
  return "Не удалось выполнить действие. Попробуйте ещё раз.";
}
export function mediaUrl(url) {
  if (!url) return "";
  // DRF строит абсолютный URL с внутренним hostname контейнера.
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname.startsWith("/media/")
      ? `${parsed.pathname}${parsed.search}`
      : url;
  } catch {
    return "";
  }
}
