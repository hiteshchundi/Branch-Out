// Package httpapi exposes the Branch-Out domain through a small REST API.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/hiteshchundi/branch-out/backend/internal/applications"
	"github.com/hiteshchundi/branch-out/backend/internal/openings"
	"github.com/hiteshchundi/branch-out/backend/internal/profile"
	"github.com/hiteshchundi/branch-out/backend/internal/safety"
	"github.com/hiteshchundi/branch-out/backend/internal/trialproposals"
)

type API struct {
	repository     openings.Repository
	openingManager OpeningManager
	applications   ApplicationManager
	trialProposals TrialProposalManager
	safety         SafetyManager
	readiness      ReadinessChecker
	authentication Authenticator
	profiles       ProfileManager
	options        Options
	allowedOrigin  string
	logger         *slog.Logger
}

type ReadinessChecker interface {
	Ping(context.Context) error
}

type ProfileManager interface {
	Get(context.Context, int64) (profile.Profile, error)
	Save(context.Context, int64, profile.Input) (profile.Profile, error)
}

type OpeningManager interface {
	ListOwned(context.Context, int64) ([]openings.ManagedOpening, error)
	CreateDraft(context.Context, int64, openings.DraftInput) (openings.ManagedOpening, error)
	UpdateDraft(context.Context, int64, string, openings.DraftInput) (openings.ManagedOpening, error)
	PublishDraft(context.Context, int64, string) (openings.ManagedOpening, error)
	CloseOpening(context.Context, int64, string) (openings.ManagedOpening, error)
}

type ApplicationManager interface {
	GetOwn(context.Context, int64, string) (applications.Application, error)
	SaveDraft(context.Context, int64, string, applications.Input) (applications.Application, error)
	Submit(context.Context, int64, string) (applications.Application, error)
	ListForOwner(context.Context, int64, string) ([]applications.OwnerApplication, error)
	Decide(context.Context, int64, string, string, string) (applications.Application, error)
	Withdraw(context.Context, int64, string) (applications.Application, error)
}

type TrialProposalManager interface {
	GetOwn(context.Context, int64, string) (trialproposals.Proposal, error)
	SaveOwnDraft(context.Context, int64, string, trialproposals.Input) (trialproposals.Proposal, error)
	SendOwn(context.Context, int64, string) (trialproposals.Proposal, error)
	ListForOwner(context.Context, int64, string) ([]trialproposals.OwnerProposal, error)
	Decide(context.Context, int64, string, string, string) (trialproposals.Proposal, error)
	ListCheckIns(context.Context, int64, string) ([]trialproposals.CheckIn, error)
	AddCheckIn(context.Context, int64, string, trialproposals.CheckInInput) (trialproposals.CheckIn, error)
	GetOutcome(context.Context, int64, string) (trialproposals.Outcome, error)
	CreateOutcome(context.Context, int64, string, trialproposals.OutcomeInput) (trialproposals.Outcome, error)
	DecideOutcome(context.Context, int64, string, string) (trialproposals.Outcome, error)
	ListFeedback(context.Context, int64, string) ([]trialproposals.Feedback, error)
	CreateFeedback(context.Context, int64, string, trialproposals.FeedbackInput) (trialproposals.Feedback, error)
	AcknowledgeFeedback(context.Context, int64, string, string) (trialproposals.Feedback, error)
	GetTrustCandidate(context.Context, int64, string) (trialproposals.TrustCandidate, error)
}

type SafetyManager interface {
	Create(context.Context, int64, safety.Input) (safety.Report, error)
	ListForModerator(context.Context, int64) ([]safety.Report, error)
	Decide(context.Context, int64, string, safety.DecisionInput) (safety.Report, error)
	CreateAppeal(context.Context, int64, safety.AppealInput) (safety.Appeal, error)
	ListAppealsForModerator(context.Context, int64) ([]safety.Appeal, error)
}

type listResponse struct {
	Data []openings.Opening `json:"data"`
	Meta struct {
		Count int `json:"count"`
	} `json:"meta"`
}

type statusResponse struct {
	Status string `json:"status"`
}

type errorEnvelope struct {
	Error apiError `json:"error"`
}

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
}

func New(repository openings.Repository, openingManager OpeningManager, applicationManager ApplicationManager, trialProposalManager TrialProposalManager, safetyManager SafetyManager, readiness ReadinessChecker, authentication Authenticator, profiles ProfileManager, options Options, logger *slog.Logger) http.Handler {
	api := &API{repository: repository, openingManager: openingManager, applications: applicationManager, trialProposals: trialProposalManager, safety: safetyManager, readiness: readiness, authentication: authentication, profiles: profiles, options: options, allowedOrigin: options.AllowedOrigin, logger: logger}
	routes := http.NewServeMux()
	routes.HandleFunc("GET /healthz", api.health)
	routes.HandleFunc("GET /readyz", api.ready)
	routes.HandleFunc("GET /v1/openings", api.listOpenings)
	routes.HandleFunc("POST /v1/openings", api.createOpeningDraft)
	routes.HandleFunc("GET /v1/openings/mine", api.listOwnedOpenings)
	routes.HandleFunc("PUT /v1/openings/{id}", api.updateOpeningDraft)
	routes.HandleFunc("POST /v1/openings/{id}/publish", api.publishOpeningDraft)
	routes.HandleFunc("POST /v1/openings/{id}/close", api.closeOpening)
	routes.HandleFunc("GET /v1/openings/{id}/application", api.getOwnApplication)
	routes.HandleFunc("PUT /v1/openings/{id}/application", api.saveApplicationDraft)
	routes.HandleFunc("POST /v1/openings/{id}/application/submit", api.submitApplication)
	routes.HandleFunc("POST /v1/openings/{id}/application/withdraw", api.withdrawApplication)
	routes.HandleFunc("GET /v1/openings/{id}/applications", api.listSubmittedApplications)
	routes.HandleFunc("POST /v1/openings/{id}/applications/{applicationId}/decision", api.decideApplication)
	routes.HandleFunc("GET /v1/openings/{id}/trial-proposal", api.getOwnTrialProposal)
	routes.HandleFunc("PUT /v1/openings/{id}/trial-proposal", api.saveOwnTrialProposal)
	routes.HandleFunc("POST /v1/openings/{id}/trial-proposal/send", api.sendOwnTrialProposal)
	routes.HandleFunc("GET /v1/openings/{id}/trial-proposals", api.listTrialProposalsForOwner)
	routes.HandleFunc("POST /v1/openings/{id}/trial-proposals/{proposalId}/decision", api.decideTrialProposal)
	routes.HandleFunc("GET /v1/trial-proposals/{proposalId}/check-ins", api.listTrialCheckIns)
	routes.HandleFunc("POST /v1/trial-proposals/{proposalId}/check-ins", api.addTrialCheckIn)
	routes.HandleFunc("GET /v1/trial-proposals/{proposalId}/outcome", api.getTrialOutcome)
	routes.HandleFunc("POST /v1/trial-proposals/{proposalId}/outcome", api.createTrialOutcome)
	routes.HandleFunc("POST /v1/trial-proposals/{proposalId}/outcome/decision", api.decideTrialOutcome)
	routes.HandleFunc("GET /v1/trial-proposals/{proposalId}/feedback", api.listTrialFeedback)
	routes.HandleFunc("POST /v1/trial-proposals/{proposalId}/feedback", api.createTrialFeedback)
	routes.HandleFunc("POST /v1/trial-proposals/{proposalId}/feedback/{feedbackId}/acknowledge", api.acknowledgeTrialFeedback)
	routes.HandleFunc("GET /v1/trial-proposals/{proposalId}/trust-candidate", api.getTrialTrustCandidate)
	routes.HandleFunc("POST /v1/safety-reports", api.createSafetyReport)
	routes.HandleFunc("GET /v1/moderation/reports", api.listModerationReports)
	routes.HandleFunc("POST /v1/moderation/reports/{reportId}/decision", api.decideModerationReport)
	routes.HandleFunc("POST /v1/moderation-appeals", api.createModerationAppeal)
	routes.HandleFunc("GET /v1/moderation/appeals", api.listModerationAppeals)
	routes.HandleFunc("GET /v1/auth/github/start", api.startGitHubAuth)
	routes.HandleFunc("GET /v1/auth/github/callback", api.finishGitHubAuth)
	routes.HandleFunc("GET /v1/session", api.currentSession)
	routes.HandleFunc("DELETE /v1/session", api.deleteSession)
	routes.HandleFunc("GET /v1/profile", api.getProfile)
	routes.HandleFunc("PUT /v1/profile", api.putProfile)
	routes.HandleFunc("OPTIONS /v1/session", api.preflight)
	routes.HandleFunc("OPTIONS /v1/profile", api.preflight)
	routes.HandleFunc("OPTIONS /v1/openings", api.preflight)
	routes.HandleFunc("OPTIONS /v1/openings/mine", api.preflight)
	routes.HandleFunc("OPTIONS /v1/openings/{id}", api.preflight)
	routes.HandleFunc("OPTIONS /v1/openings/{id}/publish", api.preflight)
	routes.HandleFunc("OPTIONS /v1/openings/{id}/close", api.preflight)
	routes.HandleFunc("OPTIONS /v1/openings/{id}/application", api.preflight)
	routes.HandleFunc("OPTIONS /v1/openings/{id}/application/submit", api.preflight)
	routes.HandleFunc("OPTIONS /v1/openings/{id}/application/withdraw", api.preflight)
	routes.HandleFunc("OPTIONS /v1/openings/{id}/applications", api.preflight)
	routes.HandleFunc("OPTIONS /v1/openings/{id}/applications/{applicationId}/decision", api.preflight)
	routes.HandleFunc("OPTIONS /v1/openings/{id}/trial-proposal", api.preflight)
	routes.HandleFunc("OPTIONS /v1/openings/{id}/trial-proposal/send", api.preflight)
	routes.HandleFunc("OPTIONS /v1/openings/{id}/trial-proposals", api.preflight)
	routes.HandleFunc("OPTIONS /v1/openings/{id}/trial-proposals/{proposalId}/decision", api.preflight)
	routes.HandleFunc("OPTIONS /v1/trial-proposals/{proposalId}/check-ins", api.preflight)
	routes.HandleFunc("OPTIONS /v1/trial-proposals/{proposalId}/outcome", api.preflight)
	routes.HandleFunc("OPTIONS /v1/trial-proposals/{proposalId}/outcome/decision", api.preflight)
	routes.HandleFunc("OPTIONS /v1/trial-proposals/{proposalId}/feedback", api.preflight)
	routes.HandleFunc("OPTIONS /v1/trial-proposals/{proposalId}/feedback/{feedbackId}/acknowledge", api.preflight)
	routes.HandleFunc("OPTIONS /v1/trial-proposals/{proposalId}/trust-candidate", api.preflight)
	routes.HandleFunc("OPTIONS /v1/safety-reports", api.preflight)
	routes.HandleFunc("OPTIONS /v1/moderation/reports", api.preflight)
	routes.HandleFunc("OPTIONS /v1/moderation/reports/{reportId}/decision", api.preflight)
	routes.HandleFunc("OPTIONS /v1/moderation-appeals", api.preflight)
	routes.HandleFunc("/", api.notFound)

	return api.recoverPanics(api.logRequests(api.cors(routes)))
}

func (api *API) health(writer http.ResponseWriter, _ *http.Request) {
	writeJSON(writer, http.StatusOK, statusResponse{Status: "ok"})
}

func (api *API) ready(writer http.ResponseWriter, request *http.Request) {
	if err := api.readiness.Ping(request.Context()); err != nil {
		api.logger.Warn("readiness check failed", "error", err)
		writeJSON(writer, http.StatusServiceUnavailable, statusResponse{Status: "unavailable"})
		return
	}

	writeJSON(writer, http.StatusOK, statusResponse{Status: "ready"})
}

func (api *API) listOpenings(writer http.ResponseWriter, request *http.Request) {
	filters, validationError := parseFilters(request)
	if validationError != nil {
		writeError(writer, http.StatusBadRequest, *validationError)
		return
	}

	results, err := api.repository.List(request.Context(), filters)
	if err != nil {
		api.logger.Error("list openings failed", "error", err)
		writeError(writer, http.StatusInternalServerError, apiError{
			Code: "internal_error", Message: "The project openings could not be loaded.",
		})
		return
	}

	response := listResponse{Data: results}
	response.Meta.Count = len(results)
	writeJSON(writer, http.StatusOK, response)
}

func parseFilters(request *http.Request) (openings.Filters, *apiError) {
	query := request.URL.Query()
	filters := openings.Filters{
		Query: query.Get("query"), Role: openings.Role(query.Get("role")),
		Compensation: openings.Compensation(query.Get("compensation")),
		Commitment:   openings.CommitmentBand(query.Get("commitment")),
	}

	if !openings.ValidRole(filters.Role) {
		return openings.Filters{}, &apiError{Code: "invalid_filter", Field: "role", Message: "role must be Engineering, Design, or Research"}
	}
	if !openings.ValidCompensation(filters.Compensation) {
		return openings.Filters{}, &apiError{Code: "invalid_filter", Field: "compensation", Message: "compensation must be Paid, Fixed bounty, Revenue share, or Portfolio"}
	}
	if !openings.ValidCommitment(filters.Commitment) {
		return openings.Filters{}, &apiError{Code: "invalid_filter", Field: "commitment", Message: "commitment must be Under 6 hrs/week, 6–8 hrs/week, or 8+ hrs/week"}
	}

	return filters, nil
}

func (api *API) preflight(writer http.ResponseWriter, _ *http.Request) {
	writer.WriteHeader(http.StatusNoContent)
}

func (api *API) notFound(writer http.ResponseWriter, request *http.Request) {
	if request.URL.Path == "/healthz" || request.URL.Path == "/readyz" || request.URL.Path == "/v1/openings" || request.URL.Path == "/v1/auth/github/start" || request.URL.Path == "/v1/auth/github/callback" || request.URL.Path == "/v1/session" || request.URL.Path == "/v1/profile" {
		writeError(writer, http.StatusMethodNotAllowed, apiError{Code: "method_not_allowed", Message: "This method is not supported for the requested resource."})
		return
	}

	writeError(writer, http.StatusNotFound, apiError{Code: "not_found", Message: "The requested resource was not found."})
}

func (api *API) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Origin") == api.allowedOrigin {
			writer.Header().Set("Access-Control-Allow-Origin", api.allowedOrigin)
			writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			writer.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type")
			writer.Header().Set("Access-Control-Allow-Credentials", "true")
			writer.Header().Set("Vary", "Origin")
		}
		next.ServeHTTP(writer, request)
	})
}

func (api *API) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		started := time.Now()
		next.ServeHTTP(writer, request)
		api.logger.Info("request completed", "method", request.Method, "path", request.URL.Path, "duration_ms", time.Since(started).Milliseconds())
	})
}

func (api *API) recoverPanics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				api.logger.Error("request panic", "value", recovered)
				writeError(writer, http.StatusInternalServerError, apiError{Code: "internal_error", Message: "The request could not be completed."})
			}
		}()
		next.ServeHTTP(writer, request)
	})
}

func writeError(writer http.ResponseWriter, status int, body apiError) {
	writeJSONStatus(writer, status, errorEnvelope{Error: body})
}

func writeJSON(writer http.ResponseWriter, status int, body any) {
	writeJSONStatus(writer, status, body)
}

func writeJSONStatus(writer http.ResponseWriter, status int, body any) {
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.WriteHeader(status)
	if err := json.NewEncoder(writer).Encode(body); err != nil && !errors.Is(err, http.ErrHandlerTimeout) {
		slog.Default().Error("encode response failed", "error", err)
	}
}
