package donegeon

import (
	"context"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"donegeon/internal/config"
	"donegeon/internal/datbase"
	"donegeon/internal/httpapi"
	"donegeon/internal/logging"
	"donegeon/internal/quickadd"
	"donegeon/internal/task"
	webdist "donegeon/web/dist"
)

func Main() {
	if err := run(); err != nil {
		slog.Error("donegeon_boot_failed", slog.Any("error", err))
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	logger := logging.New(cfg.LogLevel)

	ctx, cancel := context.WithTimeout(context.Background(), cfg.RequestTimeout)
	defer cancel()

	if err := datbase.RunMigrations(cfg.DBPath); err != nil {
		return fmt.Errorf("run migrations: %w", err)
	}

	db, err := datbase.Open(ctx, cfg.DBPath)
	if err != nil {
		return fmt.Errorf("open sqlite: %w", err)
	}
	defer func() {
		_ = db.Close()
	}()

	queries, err := datbase.LoadQueries()
	if err != nil {
		return fmt.Errorf("load embedded queries: %w", err)
	}

	parser := quickadd.NewParser()
	repo := task.NewRepository(db, queries)
	service := task.NewService(repo, parser)

	staticFS, err := fs.Sub(webdist.Files, ".")
	if err != nil {
		return fmt.Errorf("load web dist fs: %w", err)
	}

	handler := httpapi.New(logger, cfg, service, parser, staticFS)
	server := &http.Server{
		Addr:              ":" + cfg.HTTPPort,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       cfg.RequestTimeout,
	}

	logger.Info("donegeon_server_start", slog.String("addr", server.Addr), slog.String("db_path", cfg.DBPath))

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.ListenAndServe()
	}()

	sigCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	select {
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed {
			return err
		}
		return nil
	case <-sigCtx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			return err
		}
		return nil
	}
}
