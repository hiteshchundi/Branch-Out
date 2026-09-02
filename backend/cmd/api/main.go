package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hiteshchundi/branch-out/backend/internal/applications"
	"github.com/hiteshchundi/branch-out/backend/internal/auth"
	"github.com/hiteshchundi/branch-out/backend/internal/config"
	"github.com/hiteshchundi/branch-out/backend/internal/database"
	"github.com/hiteshchundi/branch-out/backend/internal/httpapi"
	"github.com/hiteshchundi/branch-out/backend/internal/openings"
	"github.com/hiteshchundi/branch-out/backend/internal/profile"
	"github.com/hiteshchundi/branch-out/backend/internal/safety"
	"github.com/hiteshchundi/branch-out/backend/internal/trialproposals"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg := config.FromEnvironment()

	databaseContext, cancelDatabase := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelDatabase()
	pool, err := pgxpool.New(databaseContext, cfg.DatabaseURL)
	if err != nil {
		logger.Error("database pool creation failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	if err := pool.Ping(databaseContext); err != nil {
		logger.Error("database connection failed", "error", err)
		os.Exit(1)
	}

	repository := openings.NewPostgresRepository(database.New(pool))
	authentication := auth.NewService(
		auth.NewPostgresStore(database.New(pool)),
		auth.NewGitHubClient(auth.GitHubConfig{
			ClientID: cfg.GitHubClientID, ClientSecret: cfg.GitHubClientSecret,
			CallbackURL: cfg.GitHubCallbackURL,
		}, nil),
	)
	profiles := profile.NewService(profile.NewPostgresStore(database.New(pool)))
	openingManager := openings.NewManager(repository, profiles)
	applicationManager := applications.NewManager(applications.NewPostgresStore(database.New(pool)), profiles)
	trialProposalManager := trialproposals.NewManager(trialproposals.NewPostgresStore(database.New(pool)))
	safetyManager := safety.NewManager(safety.NewPostgresStore(database.New(pool)))
	api := httpapi.New(repository, openingManager, applicationManager, trialProposalManager, safetyManager, pool, authentication, profiles, httpapi.Options{
		AllowedOrigin: cfg.AllowedOrigin, FrontendURL: cfg.FrontendURL, CookieSecure: cfg.CookieSecure,
	}, logger)
	server := &http.Server{
		Addr:              cfg.Address,
		Handler:           api,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	shutdownSignal, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	serverErrors := make(chan error, 1)
	go func() {
		logger.Info("api listening", "address", cfg.Address)
		serverErrors <- server.ListenAndServe()
	}()

	select {
	case err := <-serverErrors:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("api stopped unexpectedly", "error", err)
			os.Exit(1)
		}
		return
	case <-shutdownSignal.Done():
		logger.Info("api shutdown requested")
	}

	shutdownContext, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownContext); err != nil {
		logger.Error("api shutdown failed", "error", err)
		os.Exit(1)
	}

	if err := <-serverErrors; err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("api stopped unexpectedly", "error", err)
		os.Exit(1)
	}
}
