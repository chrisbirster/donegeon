package donegeon

import (
	"context"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/jmoiron/sqlx"

	"donegeon/internal/account"
	"donegeon/internal/board"
	"donegeon/internal/calendar"
	"donegeon/internal/config"
	"donegeon/internal/database"
	"donegeon/internal/httpapi"
	"donegeon/internal/logging"
	"donegeon/internal/project"
	"donegeon/internal/quickadd"
	"donegeon/internal/task"
	"donegeon/internal/taskmanagercompat"
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
		if err := database.RunMigrationsTurso(cfg.DBURL, cfg.DBAuthToken); err != nil {
			return fmt.Errorf("run turso migrations: %w", err)
		}
		db, err = database.OpenTurso(ctx, cfg.DBURL, cfg.DBAuthToken)
		if err != nil {
			return fmt.Errorf("open turso: %w", err)
		}
	default:
		logger.Info("db_backend", slog.String("backend", "sqlite"), slog.String("path", cfg.DBPath))
		if err := database.RunMigrations(cfg.DBPath); err != nil {
			return fmt.Errorf("run migrations: %w", err)
		}
		db, err = database.Open(ctx, cfg.DBPath)
		if err != nil {
			return fmt.Errorf("open sqlite: %w", err)
		}
	}
	defer func() {
		_ = db.Close()
	}()

	queries, err := database.LoadQueries()
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
	taskService.SetResolveProject(func(ctx context.Context, ref string) (*string, error) {
		projects, err := projectService.List(ctx, project.ListParams{})
		if err != nil {
			return nil, fmt.Errorf("list projects for quick-add project resolution: %w", err)
		}
		return resolveProjectIDByReference(ref, projects), nil
	})
	accountService := account.NewService(db, queries)
	taskManagerService := taskmanagercompat.NewService(db, taskService, projectService)
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
	calendarService := calendar.NewService(db, queries, calendar.Config{
		AppBaseURL:             cfg.AppBaseURL,
		GoogleClientID:         cfg.GoogleCalendarClientID,
		GoogleClientSecret:     cfg.GoogleCalendarSecret,
		OAuthStateTTL:          cfg.CalendarOAuthStateTTL,
		ProviderRequestTimeout: cfg.CalendarProviderTimeout,
	})

	logger.Info("app_runtime_config",
		slog.Bool("require_auth", cfg.RequireAuth),
		slog.Bool("auth_debug_code", cfg.AuthDebugCode),
		slog.String("app_base_url", cfg.AppBaseURL),
		slog.String("cookie_domain", cfg.CookieDomain),
		slog.Bool("cookie_secure", cfg.CookieSecure),
		slog.String("cookie_samesite", cfg.CookieSameSite),
		slog.Bool("email_sender_configured", strings.TrimSpace(cfg.EmailSendURL) != ""),
		slog.Bool("google_calendar_configured", strings.TrimSpace(cfg.GoogleCalendarClientID) != "" && strings.TrimSpace(cfg.GoogleCalendarSecret) != ""),
		slog.Bool("stripe_configured", strings.TrimSpace(cfg.StripeSecretKey) != "" && strings.TrimSpace(cfg.StripeProPriceID) != ""),
		slog.String("board_config_path", cfg.BoardConfigPath),
		slog.String("quest_config_path", cfg.QuestConfigPath),
	)

	staticFS, err := fs.Sub(webdist.Files, ".")
	if err != nil {
		return fmt.Errorf("load web dist fs: %w", err)
	}

	handler := httpapi.New(logger, cfg, taskService, projectService, boardService, calendarService, parser, taskManagerService, accountService, staticFS)
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
