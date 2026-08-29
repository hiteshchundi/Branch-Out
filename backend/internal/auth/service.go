// Package auth owns GitHub sign-in, one-time OAuth attempts, and Branch-Out sessions.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/url"
	"regexp"
	"strings"
	"time"
)

const (
	oauthAttemptLifetime = 10 * time.Minute
	sessionLifetime      = 30 * 24 * time.Hour
)

var (
	ErrNotConfigured  = errors.New("authentication is not configured")
	ErrInvalidState   = errors.New("OAuth state is invalid or expired")
	ErrInvalidSession = errors.New("session is invalid or expired")
	ErrProvider       = errors.New("GitHub authentication failed")
)

var githubLoginPattern = regexp.MustCompile(`^[A-Za-z0-9-]{1,39}$`)

type User struct {
	ID           int64   `json:"id"`
	GitHubUserID int64   `json:"githubUserId"`
	GitHubLogin  string  `json:"githubLogin"`
	DisplayName  *string `json:"displayName"`
	AvatarURL    string  `json:"avatarUrl"`
	ProfileURL   string  `json:"profileUrl"`
}

type GitHubUser struct {
	ID         int64
	Login      string
	Name       *string
	AvatarURL  string
	ProfileURL string
}

type StartResult struct {
	AuthorizationURL string
	State            string
}

type Session struct {
	Token     string
	ExpiresAt time.Time
	User      User
}

type Store interface {
	CreateOAuthAttempt(context.Context, []byte, string, time.Time) error
	ConsumeOAuthAttempt(context.Context, []byte) (string, error)
	UpsertGitHubUser(context.Context, GitHubUser) (User, error)
	CreateSession(context.Context, []byte, int64, time.Time) error
	GetSessionUser(context.Context, []byte) (User, error)
	DeleteSession(context.Context, []byte) error
}

type Provider interface {
	Configured() bool
	AuthorizationURL(state, codeChallenge string) string
	Authenticate(context.Context, string, string) (GitHubUser, error)
}

type Service struct {
	store    Store
	provider Provider
	random   io.Reader
	now      func() time.Time
}

func NewService(store Store, provider Provider) *Service {
	return &Service{store: store, provider: provider, random: rand.Reader, now: time.Now}
}

func (service *Service) Start(ctx context.Context) (StartResult, error) {
	if !service.provider.Configured() {
		return StartResult{}, ErrNotConfigured
	}

	state, err := service.randomToken()
	if err != nil {
		return StartResult{}, fmt.Errorf("generate OAuth state: %w", err)
	}
	verifier, err := service.randomToken()
	if err != nil {
		return StartResult{}, fmt.Errorf("generate PKCE verifier: %w", err)
	}
	challengeHash := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(challengeHash[:])
	stateHash := sha256.Sum256([]byte(state))

	if err := service.store.CreateOAuthAttempt(ctx, stateHash[:], verifier, service.now().Add(oauthAttemptLifetime)); err != nil {
		return StartResult{}, fmt.Errorf("store OAuth attempt: %w", err)
	}

	return StartResult{
		AuthorizationURL: service.provider.AuthorizationURL(state, challenge),
		State:            state,
	}, nil
}

func (service *Service) Finish(ctx context.Context, state, code string) (Session, error) {
	if !service.provider.Configured() {
		return Session{}, ErrNotConfigured
	}
	if state == "" || code == "" {
		return Session{}, ErrInvalidState
	}

	stateHash := sha256.Sum256([]byte(state))
	verifier, err := service.store.ConsumeOAuthAttempt(ctx, stateHash[:])
	if err != nil {
		return Session{}, err
	}

	githubUser, err := service.provider.Authenticate(ctx, code, verifier)
	if err != nil {
		return Session{}, fmt.Errorf("%w: %v", ErrProvider, err)
	}
	githubUser = normalizeGitHubUser(githubUser)
	if err := validateGitHubUser(githubUser); err != nil {
		return Session{}, fmt.Errorf("%w: %v", ErrProvider, err)
	}

	user, err := service.store.UpsertGitHubUser(ctx, githubUser)
	if err != nil {
		return Session{}, fmt.Errorf("upsert GitHub user: %w", err)
	}
	token, err := service.randomToken()
	if err != nil {
		return Session{}, fmt.Errorf("generate session token: %w", err)
	}
	expiresAt := service.now().Add(sessionLifetime)
	if err := service.store.CreateSession(ctx, hashToken(token), user.ID, expiresAt); err != nil {
		return Session{}, fmt.Errorf("create session: %w", err)
	}

	return Session{Token: token, ExpiresAt: expiresAt, User: user}, nil
}

func (service *Service) CurrentUser(ctx context.Context, token string) (User, error) {
	if token == "" {
		return User{}, ErrInvalidSession
	}
	return service.store.GetSessionUser(ctx, hashToken(token))
}

func (service *Service) Logout(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	return service.store.DeleteSession(ctx, hashToken(token))
}

func (service *Service) randomToken() (string, error) {
	buffer := make([]byte, 32)
	if _, err := io.ReadFull(service.random, buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func hashToken(token string) []byte {
	hash := sha256.Sum256([]byte(token))
	return hash[:]
}

func normalizeGitHubUser(user GitHubUser) GitHubUser {
	user.Login = strings.TrimSpace(user.Login)
	if user.Name != nil {
		name := strings.TrimSpace(*user.Name)
		if name == "" {
			user.Name = nil
		} else {
			user.Name = &name
		}
	}
	return user
}

func validateGitHubUser(user GitHubUser) error {
	if user.ID <= 0 || !githubLoginPattern.MatchString(user.Login) {
		return errors.New("GitHub returned an invalid user identity")
	}
	for _, rawURL := range []string{user.AvatarURL, user.ProfileURL} {
		parsed, err := url.Parse(rawURL)
		if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
			return errors.New("GitHub returned an invalid profile URL")
		}
	}
	return nil
}
