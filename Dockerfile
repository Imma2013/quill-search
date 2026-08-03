FROM searxng/searxng:latest

USER root

RUN if command -v apk >/dev/null 2>&1; then \
      apk add --no-cache nodejs npm; \
    else \
      apt-get update && apt-get install -y --no-install-recommends nodejs npm && rm -rf /var/lib/apt/lists/*; \
    fi

WORKDIR /opt/quill

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --workspace @quill/api --omit=dev

COPY apps/api/src apps/api/src
COPY infra/searxng/settings.yml /etc/searxng/settings.yml
COPY infra/searxng/start.sh /usr/local/bin/quill-start

RUN chmod +x /usr/local/bin/quill-start && chown -R searxng:searxng /opt/quill /etc/searxng/settings.yml /usr/local/bin/quill-start

ENV SEARXNG_SETTINGS_PATH=/etc/searxng/settings.yml
ENV GRANIAN_HOST=127.0.0.1
ENV GRANIAN_PORT=8080

USER searxng

ENTRYPOINT ["/usr/local/bin/quill-start"]
