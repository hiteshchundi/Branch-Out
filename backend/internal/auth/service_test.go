package auth

import (
	"bytes"
	"context"
	"encoding/hex"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestServiceCompletesSingleUseOAuthAndSessionLifecycle(t *testing.T) {
	name := "Asha Rao"
	store := newMemoryStore()
	provider := &fakeProvider{
		configured: true,
		user: GitHubUser{
			ID: 42, Login: "asha-rao", Name: &name,
			AvatarURL:  "https://avatars.githubusercontent.com/u/42",
			ProfileURL: "https://github.com/asha-rao",
		},
	}
	service := NewService(store, provider)
	service.now = func() time.Time { return time.Date(2026, 8, 29, 10, 0, 0, 0, time.UTC) }
	service.random = bytes.NewReader(append(
		append(bytes.Repeat([]byte{1}, 32), bytes.Repeat([]byte{2}, 32)...),
		bytes.Repeat([]byte{3}, 32)...,
	))

	start, err := service.Start(context.Background())
	if err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	if start.State == "" || !strings.Contains(start.AuthorizationURL, "challenge=") {
		t.Fatalf("Start() = %#v, want state and PKCE challenge", start)
	}
	if store.lastVerifier == "" || store.lastExpiry.Sub(service.now()) != oauthAttemptLifetime {
		t.Fatalf("OAuth attempt was not stored with verifier and ten-minute expiry")
	}

	session, err := service.Finish(context.Background(), start.State, "temporary-code")
	if err != nil {
		t.Fatalf("Finish() error = %v", err)
	}
	if provider.code != "temporary-code" || provider.verifier != store.lastVerifier {
		t.Fatalf("provider received code %q and verifier %q", provider.code, provider.verifier)
	}
	if session.User.GitHubLogin != "asha-rao" || session.ExpiresAt.Sub(service.now()) != sessionLifetime {
		t.Fatalf("Finish() session = %#v", session)
	}
	if _, exists := store.sessions[session.Token]; exists {
		t.Fatal("raw session token was stored instead of its hash")
	}

	current, err := service.CurrentUser(context.Background(), session.Token)
	if err != nil || current.ID != session.User.ID {
		t.Fatalf("CurrentUser() = %#v, %v", current, err)
	}
	if err := service.Logout(context.Background(), session.Token); err != nil {
		t.Fatalf("Logout() error = %v", err)
	}
	if _, err := service.CurrentUser(context.Background(), session.Token); !errors.Is(err, ErrInvalidSession) {
		t.Fatalf("CurrentUser() after logout error = %v, want ErrInvalidSession", err)
	}
	if _, err := service.Finish(context.Background(), start.State, "replayed-code"); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("replayed Finish() error = %v, want ErrInvalidState", err)
	}
}

func TestServiceRejectsUnavailableProviderAndInvalidIdentity(t *testing.T) {
	store := newMemoryStore()
	service := NewService(store, &fakeProvider{})
	if _, err := service.Start(context.Background()); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("Start() error = %v, want ErrNotConfigured", err)
	}

	provider := &fakeProvider{configured: true, user: GitHubUser{ID: -1}}
	service = NewService(store, provider)
	service.random = bytes.NewReader(bytes.Repeat([]byte{4}, 96))
	start, err := service.Start(context.Background())
	if err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	if _, err := service.Finish(context.Background(), start.State, "code"); !errors.Is(err, ErrProvider) {
		t.Fatalf("Finish() error = %v, want ErrProvider", err)
	}
}

type fakeProvider struct {
	configured bool
	user       GitHubUser
	err        error
	code       string
	verifier   string
}

func (provider *fakeProvider) Configured() bool { return provider.configured }

func (provider *fakeProvider) AuthorizationURL(state, challenge string) string {
	return "https://github.test/authorize?state=" + state + "&challenge=" + challenge
}

func (provider *fakeProvider) Authenticate(_ context.Context, code, verifier string) (GitHubUser, error) {
	provider.code = code
	provider.verifier = verifier
	return provider.user, provider.err
}

type memoryStore struct {
	attempts     map[string]string
	sessions     map[string]User
	lastVerifier string
	lastExpiry   time.Time
	user         User
}

func newMemoryStore() *memoryStore {
	return &memoryStore{attempts: map[string]string{}, sessions: map[string]User{}}
}

func (store *memoryStore) CreateOAuthAttempt(_ context.Context, hash []byte, verifier string, expiry time.Time) error {
	store.attempts[hex.EncodeToString(hash)] = verifier
	store.lastVerifier = verifier
	store.lastExpiry = expiry
	return nil
}

func (store *memoryStore) ConsumeOAuthAttempt(_ context.Context, hash []byte) (string, error) {
	key := hex.EncodeToString(hash)
	verifier, exists := store.attempts[key]
	if !exists {
		return "", ErrInvalidState
	}
	delete(store.attempts, key)
	return verifier, nil
}

func (store *memoryStore) UpsertGitHubUser(_ context.Context, githubUser GitHubUser) (User, error) {
	store.user = User{
		ID: 1, GitHubUserID: githubUser.ID, GitHubLogin: githubUser.Login,
		DisplayName: githubUser.Name, AvatarURL: githubUser.AvatarURL, ProfileURL: githubUser.ProfileURL,
	}
	return store.user, nil
}

func (store *memoryStore) CreateSession(_ context.Context, hash []byte, _ int64, _ time.Time) error {
	store.sessions[hex.EncodeToString(hash)] = store.user
	return nil
}

func (store *memoryStore) GetSessionUser(_ context.Context, hash []byte) (User, error) {
	user, exists := store.sessions[hex.EncodeToString(hash)]
	if !exists {
		return User{}, ErrInvalidSession
	}
	return user, nil
}

func (store *memoryStore) DeleteSession(_ context.Context, hash []byte) error {
	delete(store.sessions, hex.EncodeToString(hash))
	return nil
}
