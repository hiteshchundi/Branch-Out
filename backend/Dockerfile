# syntax=docker/dockerfile:1

FROM golang:1.27-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/branch-out-api ./cmd/api \
    && GOBIN=/out CGO_ENABLED=0 go install github.com/pressly/goose/v3/cmd/goose@v3.27.3

FROM alpine:3.22

RUN apk add --no-cache ca-certificates \
    && addgroup -S branchout \
    && adduser -S -G branchout -h /app branchout

WORKDIR /app
COPY --from=build /out/branch-out-api /app/branch-out-api
COPY --from=build /out/goose /app/goose
COPY db/migrations /app/migrations

USER branchout
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
    CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1

ENTRYPOINT ["/app/branch-out-api"]
