package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	defaultAuthorizationURL = "https://github.com/login/oauth/authorize"
	defaultTokenURL         = "https://github.com/login/oauth/access_token"
	defaultUserURL          = "https://api.github.com/user"
	githubAPIVersion        = "2022-11-28"
	maximumGitHubResponse   = 1 << 20
)

type GitHubConfig struct {
	ClientID         string
	ClientSecret     string
	CallbackURL      string
	AuthorizationURL string
	TokenURL         string
	UserURL          string
}

type GitHubClient struct {
	config     GitHubConfig
	httpClient *http.Client
}

func NewGitHubClient(config GitHubConfig, httpClient *http.Client) *GitHubClient {
	if config.AuthorizationURL == "" {
		config.AuthorizationURL = defaultAuthorizationURL
	}
	if config.TokenURL == "" {
		config.TokenURL = defaultTokenURL
	}
	if config.UserURL == "" {
		config.UserURL = defaultUserURL
	}
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 10 * time.Second}
	}
	return &GitHubClient{config: config, httpClient: httpClient}
}

func (client *GitHubClient) Configured() bool {
	return client.config.ClientID != "" && client.config.ClientSecret != "" && client.config.CallbackURL != ""
}

func (client *GitHubClient) AuthorizationURL(state, codeChallenge string) string {
	query := url.Values{
		"client_id":             {client.config.ClientID},
		"redirect_uri":          {client.config.CallbackURL},
		"state":                 {state},
		"code_challenge":        {codeChallenge},
		"code_challenge_method": {"S256"},
	}
	return client.config.AuthorizationURL + "?" + query.Encode()
}

func (client *GitHubClient) Authenticate(ctx context.Context, code, verifier string) (GitHubUser, error) {
	token, err := client.exchangeCode(ctx, code, verifier)
	if err != nil {
		return GitHubUser{}, err
	}
	return client.fetchUser(ctx, token)
}

func (client *GitHubClient) exchangeCode(ctx context.Context, code, verifier string) (string, error) {
	form := url.Values{
		"client_id":     {client.config.ClientID},
		"client_secret": {client.config.ClientSecret},
		"code":          {code},
		"redirect_uri":  {client.config.CallbackURL},
		"code_verifier": {verifier},
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, client.config.TokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	request.Header.Set("User-Agent", "Branch-Out")

	response, err := client.httpClient.Do(request)
	if err != nil {
		return "", fmt.Errorf("exchange authorization code: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("exchange authorization code: GitHub returned HTTP %d", response.StatusCode)
	}

	var body struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := decodeGitHubJSON(response.Body, &body); err != nil {
		return "", fmt.Errorf("decode access token response: %w", err)
	}
	if body.Error != "" || body.AccessToken == "" {
		return "", errors.New("GitHub rejected the authorization code")
	}
	return body.AccessToken, nil
}

func (client *GitHubClient) fetchUser(ctx context.Context, token string) (GitHubUser, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, client.config.UserURL, nil)
	if err != nil {
		return GitHubUser{}, err
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("X-GitHub-Api-Version", githubAPIVersion)
	request.Header.Set("User-Agent", "Branch-Out")

	response, err := client.httpClient.Do(request)
	if err != nil {
		return GitHubUser{}, fmt.Errorf("fetch GitHub user: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return GitHubUser{}, fmt.Errorf("fetch GitHub user: GitHub returned HTTP %d", response.StatusCode)
	}

	var body struct {
		ID        int64   `json:"id"`
		Login     string  `json:"login"`
		Name      *string `json:"name"`
		AvatarURL string  `json:"avatar_url"`
		HTMLURL   string  `json:"html_url"`
	}
	if err := decodeGitHubJSON(response.Body, &body); err != nil {
		return GitHubUser{}, fmt.Errorf("decode GitHub user: %w", err)
	}
	return GitHubUser{ID: body.ID, Login: body.Login, Name: body.Name, AvatarURL: body.AvatarURL, ProfileURL: body.HTMLURL}, nil
}

func decodeGitHubJSON(reader io.Reader, target any) error {
	decoder := json.NewDecoder(io.LimitReader(reader, maximumGitHubResponse))
	return decoder.Decode(target)
}
