# ---------- build ----------
FROM node:22-alpine AS build

WORKDIR /app

# Certificado CA local opcional (proxy/antivirus com inspecao TLS na maquina
# de desenvolvimento, ex.: Kaspersky) -- .docker-ca/ fica fora do controle de
# versao (gitignored); em CI/outras maquinas so existe o .gitkeep, e o
# arquivo combinado fica vazio (no-op). Node.js ignora o CA store do SO e usa
# so o bundle Mozilla embutido no binario -- appendar em
# /etc/ssl/certs/ca-certificates.crt (o que funciona para Go/apk) nao tem
# nenhum efeito aqui; e preciso apontar NODE_EXTRA_CA_CERTS explicitamente.
COPY .docker-ca/ /tmp/local-ca/
RUN touch /tmp/local-ca/combined.pem && \
    find /tmp/local-ca -name '*.crt' -exec cat {} \; >> /tmp/local-ca/combined.pem
ENV NODE_EXTRA_CA_CERTS=/tmp/local-ca/combined.pem

# O lockfile muda menos que o codigo: instalar antes aproveita o cache.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# A URL da API e resolvida em tempo de build (Vite embute no bundle).
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---------- runtime ----------
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
