package httpapi

import (
	"context"
	"crypto/subtle"
	"errors"
	"net/http"
	"net/url"
	"time"

	"github.com/hiteshchundi/branch-out/backend/internal/auth"
)

const (
	oauthStateCookieName = "branch_out_oauth_state"
	sessionCookieName    = "branch_out_session"
	oauthCookieMaxAge    = 10 * 60
	sessionCookieMaxAge  = 30 * 24 * 60 * 60
)

type Options struct {
	AllowedOrigin string
	FrontendURL   string
	CookieSecure  bool
}

type Authenticator interface {
	Start(context.Context) (auth.StartResult, error)
	Finish(context.Context, string, string) (auth.Session, error)
	CurrentUser(context.Context, string) (auth.User, error)
	Logout(context.Context, string) error
}

type sessionResponse struct {
	Data auth.User `json:"data"`
}

func (api *API) startGitHubAuth(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	result, err := api.authentication.Start(request.Context())
	if errors.Is(err, auth.ErrNotConfigured) {
		writeError(writer, http.StatusServiceUnavailable, apiError{
			Code: "authentication_unavailable", Message: "GitHub authentication is not configured.",
		})
		return
	}
	if err != nil {
		api.logger.Error("start GitHub authentication failed", "error", err)
		writeError(writer, http.StatusInternalServerError, apiError{
			Code: "internal_error", Message: "GitHub authentication could not be started.",
		})
		return
	}

	http.SetCookie(writer, api.oauthStateCookie(result.State, oauthCookieMaxAge))
	http.Redirect(writer, request, result.AuthorizationURL, http.StatusSeeOther)
}

func (api *API) finishGitHubAuth(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	if request.URL.Query().Get("error") != "" {
		http.SetCookie(writer, api.oauthStateCookie("", -1))
		api.redirectToFrontend(writer, request, "denied")
		return
	}

	stateCookie, cookieError := request.Cookie(oauthStateCookieName)
	queryState := request.URL.Query().Get("state")
	if cookieError != nil || queryState == "" || subtle.ConstantTimeCompare([]byte(stateCookie.Value), []byte(queryState)) != 1 {
		http.SetCookie(writer, api.oauthStateCookie("", -1))
		api.redirectToFrontend(writer, request, "invalid_state")
		return
	}

	session, err := api.authentication.Finish(request.Context(), queryState, request.URL.Query().Get("code"))
	http.SetCookie(writer, api.oauthStateCookie("", -1))
	if err != nil {
		api.logger.Warn("finish GitHub authentication failed", "error", err)
		api.redirectToFrontend(writer, request, "error")
		return
	}

	http.SetCookie(writer, api.sessionCookie(session.Token, session.ExpiresAt, sessionCookieMaxAge))
	api.redirectToFrontend(writer, request, "success")
}

func (api *API) currentSession(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	cookie, err := request.Cookie(sessionCookieName)
	if err != nil {
		writeError(writer, http.StatusUnauthorized, apiError{Code: "authentication_required", Message: "Log in to continue."})
		return
	}

	user, err := api.authentication.CurrentUser(request.Context(), cookie.Value)
	if errors.Is(err, auth.ErrInvalidSession) {
		http.SetCookie(writer, api.sessionCookie("", time.Unix(0, 0), -1))
		writeError(writer, http.StatusUnauthorized, apiError{Code: "authentication_required", Message: "Log in to continue."})
		return
	}
	if err != nil {
		api.logger.Error("load current session failed", "error", err)
		writeError(writer, http.StatusInternalServerError, apiError{Code: "internal_error", Message: "The session could not be loaded."})
		return
	}
	writeJSON(writer, http.StatusOK, sessionResponse{Data: user})
}

func (api *API) deleteSession(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	cookie, err := request.Cookie(sessionCookieName)
	if err == nil {
		if err := api.authentication.Logout(request.Context(), cookie.Value); err != nil {
			api.logger.Error("delete session failed", "error", err)
			writeError(writer, http.StatusInternalServerError, apiError{Code: "internal_error", Message: "The session could not be ended."})
			return
		}
	}
	http.SetCookie(writer, api.sessionCookie("", time.Unix(0, 0), -1))
	writer.WriteHeader(http.StatusNoContent)
}

func (api *API) oauthStateCookie(value string, maxAge int) *http.Cookie {
	cookie := &http.Cookie{
		Name: oauthStateCookieName, Value: value, Path: "/v1/auth/github/callback",
		HttpOnly: true, Secure: api.options.CookieSecure, SameSite: http.SameSiteLaxMode,
		MaxAge: maxAge,
	}
	if maxAge < 0 {
		cookie.Expires = time.Unix(0, 0)
	}
	return cookie
}

func (api *API) sessionCookie(value string, expiresAt time.Time, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name: sessionCookieName, Value: value, Path: "/",
		HttpOnly: true, Secure: api.options.CookieSecure, SameSite: http.SameSiteLaxMode,
		MaxAge: maxAge, Expires: expiresAt,
	}
}

func (api *API) redirectToFrontend(writer http.ResponseWriter, request *http.Request, status string) {
	destination, err := url.Parse(api.options.FrontendURL)
	if err != nil || destination.Scheme == "" || destination.Host == "" {
		api.logger.Error("frontend redirect URL is invalid")
		writeError(writer, http.StatusInternalServerError, apiError{Code: "internal_error", Message: "Authentication could not be completed."})
		return
	}
	query := destination.Query()
	query.Set("auth", status)
	destination.RawQuery = query.Encode()
	http.Redirect(writer, request, destination.String(), http.StatusSeeOther)
}
