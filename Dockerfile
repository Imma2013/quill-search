FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV SEARXNG_SETTINGS_PATH=/etc/searxng/settings.yml

RUN apt-get update \
  && apt-get install -y --no-install-recommends git python3 python3-venv \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --shell /usr/sbin/nologin quill

RUN git clone --depth 1 https://github.com/searxng/searxng.git /opt/searxng \
  && python3 -m venv /opt/searxng/.venv \
  && /opt/searxng/.venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/searxng/.venv/bin/pip install --no-cache-dir -r /opt/searxng/requirements.txt gunicorn

WORKDIR /opt/quill/apps/api

COPY apps/api/package.json ./
RUN npm install --omit=dev

COPY apps/api/src ./src
COPY infra/searxng/settings.yml /etc/searxng/settings.yml
COPY infra/searxng/start.sh /usr/local/bin/quill-start

RUN chmod +x /usr/local/bin/quill-start \
  && chown -R quill:quill /opt/quill /opt/searxng /etc/searxng/settings.yml /usr/local/bin/quill-start

USER quill

ENTRYPOINT ["/usr/local/bin/quill-start"]
