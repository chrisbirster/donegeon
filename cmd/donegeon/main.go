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

	"github.com/jmoiron/sqlx"

	"donegeon/internal/account"
	"donegeon/internal/board"
	"donegeon/internal/config"
	"donegeon/internal/datbase"
	"donegeon/internal/httpapi"
	"donegeon/internal/logging"
	"donegeon/internal/project"
	"donegeon/internal/quickadd"
	"donegeon/internal/task"
	"donegeon/internal/todoistcompat"
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

	var db *sqlx.DB
	switch cfg.DBBackend {
	case "turso":
		logger.Info("db_backend", slog.String("backend", "turso"), slog.String("url", cfg.DBURL))
		if err := datbase.RunMigrationsTurso(cfg.DBURL, cfg.DBAuthToken); err != nil {
			return fmt.Errorf("run turso migrations: %w", err)
		}
		db, err = datbase.OpenTurso(ctx, cfg.DBURL, cfg.DBAuthToken)
		if err != nil {
			return fmt.Errorf("open turso: %w", err)
		}
	default:
		logger.Info("db_backend", slog.String("backend", "sqlite"), slog.String("path", cfg.DBPath))
		if err := datbase.RunMigrations(cfg.DBPath); err != nil {
			return fmt.Errorf("run migrations: %w", err)
		}
		db, err = datbase.Open(ctx, cfg.DBPath)
		if err != nil {
			return fmt.Errorf("open sqlite: %w", err)
		}
	}
	defer func() {
		_ = db.Close()
	}()

	queries, err := datbase.LoadQueries()
	if err != nil {
		return fmt.Errorf("load embedded queries: %w", err)
	}

	parser := quickadd.NewParser()
	taskRepo := task.NewRepository(db, queries)
	taskService := task.NewService(taskRepo, parser)
	projectRepo := project.NewRepository(db, queries)
	projectService := project.NewService(projectRepo)

	// Auto-create projects when a task references one that doesn't exist yet.
	taskService.SetEnsureProject(func(ctx context.Context, slug string) error {
		_, err := projectService.Upsert(ctx, slug, project.UpsertInput{})
		return err
	})
	accountService := account.NewService(db)
	todoistService := todoistcompat.NewService(db, taskService, projectService)
	boardRepo := board.NewRepository(db, queries)
	boardCfg, err := board.LoadGameplayConfig(cfg.BoardConfigPath)
	if err != nil {
		return fmt.Errorf("load board config: %w", err)
	}
	questCatalog, err := board.LoadQuestCatalog(cfg.QuestConfigPath)
	if err != nil {
		return fmt.Errorf("load quest config: %w", err)
	}
	boardService := board.NewService(
		boardRepo,
		taskService,
		board.WithGameplayConfig(boardCfg),
		board.WithQuestCatalog(questCatalog),
	)

	staticFS, err := fs.Sub(webdist.Files, ".")
	if err != nil {
		return fmt.Errorf("load web dist fs: %w", err)
	}

	handler := httpapi.New(logger, cfg, taskService, projectService, boardService, parser, todoistService, accountService, staticFS)
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
