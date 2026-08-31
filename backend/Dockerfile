# ---------- build ----------
FROM golang:1.25-alpine AS build

WORKDIR /src

# Certificado CA local opcional (proxy/antivirus com inspecao TLS na maquina
# de desenvolvimento, ex.: Kaspersky) -- .docker-ca/ fica fora do controle de
# versao (gitignored); em CI/outras maquinas so existe o .gitkeep, e este
# passo vira no-op.
COPY .docker-ca/ /usr/local/share/ca-certificates/
RUN find /usr/local/share/ca-certificates -maxdepth 1 -name '*.crt' -print -quit | grep -q . && update-ca-certificates || true

# As dependencias mudam menos que o codigo: baixa-las antes aproveita o cache.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/api ./cmd/api

# ---------- runtime ----------
FROM alpine:3.20

# Mesmo certificado local do estagio de build: a imagem base ja traz um
# bundle minimo (ca-certificates-bundle) que o apk usa para o proprio fetch
# HTTPS -- acrescentar aqui destrava o "apk add" abaixo quando a rede local
# intercepta TLS. Reaplicado depois de instalar ca-certificates de verdade,
# porque o pacote regenera o bundle a partir do zero.
COPY .docker-ca/ /usr/local/share/ca-certificates/
RUN find /usr/local/share/ca-certificates -maxdepth 1 -name '*.crt' -exec cat {} \; >> /etc/ssl/certs/ca-certificates.crt 2>/dev/null || true

RUN apk add --no-cache ca-certificates tzdata && \
    (find /usr/local/share/ca-certificates -maxdepth 1 -name '*.crt' -print -quit | grep -q . && update-ca-certificates || true) && \
    adduser -D -u 10001 pcp
ENV TZ=America/Sao_Paulo

COPY --from=build /bin/api /usr/local/bin/api

USER pcp
EXPOSE 8000

# As migrations vao embarcadas no binario (go:embed), nao ha assets externos.
ENTRYPOINT ["/usr/local/bin/api"]
