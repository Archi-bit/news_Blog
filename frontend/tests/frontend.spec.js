import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const cover = fileURLToPath(new URL("./fixtures/cover.png", import.meta.url));
const username = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const password = "LearningNews!7826";

async function noHorizontalOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
async function accessible(page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      description: v.description,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
}

test("Гость: лента, пагинация, сортировка, категории, поиск и 404", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Мир полон историй/ }),
  ).toBeVisible();
  await expect(page.locator(".article-card")).toHaveCount(10);
  await accessible(page);
  await noHorizontalOverflow(page);
  await page.getByRole("button", { name: "Далее", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator(".article-card").first()).toBeVisible();
  await page.getByLabel("Сортировка статей").selectOption("-like_count");
  await expect(page).not.toHaveURL(/page=2/);
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("link", { name: "Темы", exact: true })
    .click();
  await expect(page.locator(".category-tile")).toHaveCount(5);
  await page
    .locator(".category-tile")
    .filter({ has: page.getByRole("heading", { name: "Наука", exact: true }) })
    .click();
  await expect(
    page.getByRole("heading", { name: "Наука", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".article-card").first()).toBeVisible();
  await page.goto("/search");
  await page.getByLabel("Поисковый запрос").fill("Python");
  await page
    .locator(".search-page-form")
    .getByRole("button", { name: "Найти", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Как Python помогает автоматизировать повседневные задачи",
    }),
  ).toBeVisible();
  await page.getByLabel("Поисковый запрос").fill("zznoresult987654");
  await page
    .locator(".search-page-form")
    .getByRole("button", { name: "Найти", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ничего не нашлось" }),
  ).toBeVisible();
  await page.goto("/missing-page");
  await expect(
    page.getByRole("heading", { name: "Эта история ещё не написана." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("Автор: регистрация, JWT, изображения, CRUD, комментарии, профиль, подписки и logout", async ({
  page,
  browser,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/register");
  await page.getByLabel("Имя пользователя", { exact: true }).fill(username);
  await page.getByLabel("Электронная почта").fill(`${username}@example.com`);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByLabel("Повторите пароль").fill("different");
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await expect(
    page.getByText("Пароли не совпадают.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Повторите пароль").fill(password);
  appendFileSync(".e2e-accounts.jsonl", JSON.stringify({ username }) + "\n");
  const registration = page.waitForResponse(
    (r) =>
      r.url().endsWith("/auth/register/") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  expect((await registration).status()).toBe(201);
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Имя пользователя", { exact: true }).fill(username);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.locator('[aria-label="Меню профиля"]')).toBeVisible();
  expect(
    await page.evaluate(() => ({
      local: window.localStorage.length,
      session: window.sessionStorage.length,
      refreshReadable: document.cookie.includes("refresh_token"),
    })),
  ).toEqual({ local: 0, session: 0, refreshReadable: false });
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "refresh_token").httpOnly).toBe(true);
  // Два реальных запроса получают 401 от Django; успешные ответы не подменяются.
  await expect(page.locator(".article-card")).toHaveCount(10);
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("link", { name: "Темы", exact: true })
    .click();
  await expect(page.locator(".category-tile")).toHaveCount(5);
  let rejectedRequests = 0;
  let refreshRequests = 0;
  const trackRefresh = (request) => {
    if (request.url().endsWith("/auth/refresh/") && request.method() === "POST")
      refreshRequests += 1;
  };
  page.on("request", trackRefresh);
  await page.route("**/api/v1/articles/?*", (route) => {
    if (rejectedRequests < 2) {
      rejectedRequests += 1;
      return route.continue({
        headers: {
          ...route.request().headers(),
          authorization: "Bearer deliberately-invalid-e2e-token",
        },
      });
    }
    return route.continue();
  });
  await page.locator(".header-inner .brand").click();
  await expect(page.locator(".article-card")).toHaveCount(10);
  await expect(page.locator(".popular-story")).toHaveCount(3);
  expect(rejectedRequests).toBe(2);
  expect(refreshRequests).toBe(1);
  await page.unroute("**/api/v1/articles/?*");
  page.off("request", trackRefresh);
  await page.locator(".write-link").click();
  await page
    .getByLabel("Заголовок", { exact: true })
    .fill(`Тестовая история ${username}`);
  await page
    .getByLabel("Краткое описание")
    .fill("Опыт браузерной проверки настоящего API.");
  await page
    .getByLabel("Ваша история", { exact: true })
    .fill(
      "Первый абзац о науке.\n\nВторой абзац с <script>window.newsXss = true</script>.",
    );
  await page
    .getByLabel("Тема", { exact: true })
    .selectOption({ label: "Наука" });
  await page.getByRole("checkbox", { name: "Space", exact: true }).check();
  await page.getByLabel("Обложка", { exact: true }).setInputFiles(cover);
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(
    page
      .locator(".editor-preview")
      .getByRole("heading", { name: `Тестовая история ${username}` }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Вернуться к редактированию" })
    .click();
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(page).toHaveURL(/\/articles\/\d+$/);
  const articleUrl = page.url();
  const articleId = articleUrl.split("/").pop();
  await expect(page.locator(".draft-label")).toBeVisible();
  await expect(page.locator(".article-cover img")).toBeVisible();
  expect(await page.evaluate(() => window.newsXss)).toBeUndefined();
  const guest = await browser.newContext({
    ignoreHTTPSErrors: process.env.E2E_IGNORE_HTTPS_ERRORS === "true",
  });
  const guestPage = await guest.newPage();
  await guestPage.goto(articleUrl);
  await expect(guestPage.getByRole("alert")).toContainText(
    "Страница не найдена",
  );
  await guest.close();
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(page.locator(".draft-label")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Поставить лайк", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Убрать лайк", exact: true }),
  ).toHaveText("1");
  await page.getByRole("button", { name: "Убрать лайк", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Поставить лайк", exact: true }),
  ).toHaveText("0");
  await page.getByLabel("Ваш комментарий").fill("Проверяем живое обсуждение");
  await page.getByRole("button", { name: "Отправить комментарий" }).click();
  const comment = page
    .locator(".comment")
    .filter({ hasText: "Проверяем живое обсуждение" });
  await expect(comment).toBeVisible();
  await comment
    .getByRole("button", { name: "Редактировать", exact: true })
    .click();
  await page
    .getByLabel("Редактировать комментарий")
    .fill("Отредактированный комментарий");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  const edited = page
    .locator(".comment")
    .filter({ hasText: "Отредактированный комментарий" });
  await expect(edited).toBeVisible();
  await edited.getByRole("button", { name: "Удалить", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Удалить", exact: true })
    .click();
  await expect(page.locator(".comment")).toHaveCount(0);
  await page.getByRole("link", { name: "Редактировать", exact: true }).click();
  await page
    .getByLabel("Заголовок", { exact: true })
    .fill(`Обновлённая история ${username}`);
  await page.getByRole("checkbox", { name: "Space", exact: true }).uncheck();
  await page.getByLabel("Обложка", { exact: true }).setInputFiles(cover);
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: `Обновлённая история ${username}` }),
  ).toBeVisible();
  await expect(page.locator(".reading-tags a")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Снять с публикации", exact: true })
    .click();
  await expect(page.locator(".draft-label")).toBeVisible();
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(page.locator(".draft-label")).toHaveCount(0);
  const oldRefresh = (await page.context().cookies()).find(
    (c) => c.name === "refresh_token",
  ).value;
  await page.reload();
  await expect(page.locator('[aria-label="Меню профиля"]')).toBeVisible();
  expect(
    (await page.context().cookies()).find((c) => c.name === "refresh_token")
      .value,
  ).not.toBe(oldRefresh);
  await page.locator('[aria-label="Меню профиля"]').click();
  await page.getByRole("link", { name: "Мой профиль", exact: true }).click();
  await page
    .getByRole("link", { name: "Редактировать профиль", exact: true })
    .click();
  await page.getByLabel("Имя", { exact: true }).fill("Тестовый");
  await page.getByLabel("Фамилия", { exact: true }).fill("Автор");
  await page.getByLabel("О себе").fill("Пишу проверенные истории.");
  await page.getByLabel("Фото профиля").setInputFiles(cover);
  await page.getByRole("button", { name: "Сохранить профиль" }).click();
  await expect(
    page.getByRole("heading", { name: "Тестовый Автор", exact: true }),
  ).toBeVisible();
  await page.goto("/users/1");
  await page.getByRole("button", { name: "Подписаться", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Вы подписаны", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("link", { name: "Подписки", exact: true })
    .click();
  await expect(page.locator(".user-list-item")).toHaveCount(1);
  await page.getByRole("button", { name: "Вы подписаны", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Здесь пока никого нет" }),
  ).toBeVisible();
  await page.goto(`/articles/${articleId}`);
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Удалить", exact: true })
    .click();
  await expect(page).toHaveURL(/\/my-articles$/);
  await expect(
    page.getByRole("heading", { name: "Ваша первая история впереди" }),
  ).toBeVisible();
  await page.locator('[aria-label="Меню профиля"]').click();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(
    page.locator(".header-actions").getByRole("link", { name: /Войти/ }),
  ).toBeVisible();
  await page.goto("/drafts");
  await expect(page).toHaveURL(/\/login\?next=/);
  expect(errors).toEqual([]);
});

test("Серверная ошибка входа отображается без фиктивного успеха", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByLabel("Имя пользователя", { exact: true })
    .fill("nonexistent_e2e_user");
  await page.getByLabel("Пароль", { exact: true }).fill("WrongPassword!123");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Неверный логин или пароль",
  );
  await expect(page).toHaveURL(/\/login/);
  await accessible(page);
});

test("Мобильная версия: меню, лента, поиск, форма и отсутствие горизонтальной прокрутки", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".article-card")).toHaveCount(10);
  await noHorizontalOverflow(page);
  await accessible(page);
  await page.screenshot({
    path: "test-results/mobile-home.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Открыть меню", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Мобильная навигация" })
    .getByRole("link", { name: "Поиск", exact: true })
    .click();
  await expect(page.getByLabel("Поисковый запрос")).toBeVisible();
  await noHorizontalOverflow(page);
  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Создать аккаунт", exact: true }),
  ).toBeVisible();
  await noHorizontalOverflow(page);
  await accessible(page);
});

test("Сбой сети показывает ошибку и позволяет повторить загрузку", async ({
  page,
}) => {
  await page.route("**/api/v1/articles/**", (route) => route.abort("failed"));
  await page.goto("/");
  await expect(page.locator(".feed-section").getByRole("alert")).toContainText(
    "Не удалось связаться с сервером",
  );
  await page.unroute("**/api/v1/articles/**");
  await page
    .locator(".feed-section")
    .getByRole("button", { name: "Попробовать снова", exact: true })
    .click();
  await expect(page.locator(".article-card")).toHaveCount(10);
});
