FROM golang:1.26.7-bookworm AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 go build -trimpath -ldflags="-s -w" -o /out/server .

FROM debian:bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=build /out/server /app/server
COPY donegeon_config.yml /app/donegeon_config.yml
COPY docs/quests.yaml /app/docs/quests.yaml

ENV DONEGEON_ENV=production
ENV DONEGEON_ADDR=:42069
ENV DONEGEON_CONFIG_PATH=/app/donegeon_config.yml
ENV DONEGEON_QUEST_CONFIG_PATH=/app/docs/quests.yaml

EXPOSE 42069
RUN useradd -u 10001 -m appuser
RUN mkdir -p /app/data && chown -R appuser:appuser /app
USER appuser
ENTRYPOINT ["/app/server"]
