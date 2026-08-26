# ---------- build ----------
FROM golang:1.25-alpine AS build

WORKDIR /src

# As dependencias mudam menos que o codigo: baixa-las antes aproveita o cache.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/api ./cmd/api

# ---------- runtime ----------
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata && \
    adduser -D -u 10001 pcp
ENV TZ=America/Sao_Paulo

COPY --from=build /bin/api /usr/local/bin/api

USER pcp
EXPOSE 8000

# As migrations vao embarcadas no binario (go:embed), nao ha assets externos.
ENTRYPOINT ["/usr/local/bin/api"]
