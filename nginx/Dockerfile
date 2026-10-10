FROM node:22.22.0-bookworm-slim AS react-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:1.30.5
COPY --from=react-build /build/dist /usr/share/nginx/html
COPY nginx/templates/ /etc/news-blog/templates/
COPY nginx/proxy.conf /etc/news-blog/proxy.conf
COPY nginx/security-headers.conf /etc/news-blog/security-headers.conf
COPY nginx/15-news-blog.sh /docker-entrypoint.d/15-news-blog.sh
RUN chmod +x /docker-entrypoint.d/15-news-blog.sh \
    && sed -i '/^[[:space:]]*access_log[[:space:]]/d' /etc/nginx/nginx.conf
