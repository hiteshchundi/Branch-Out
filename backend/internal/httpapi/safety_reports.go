package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/hiteshchundi/branch-out/backend/internal/safety"
)

type safetyReportResponse struct {
	Data safety.Report `json:"data"`
}
type safetyReportReceipt struct {
	ID         string    `json:"id"`
	TargetKind string    `json:"targetKind"`
	TargetID   string    `json:"targetId"`
	Category   string    `json:"category"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"createdAt"`
}
type safetyReportReceiptResponse struct {
	Data safetyReportReceipt `json:"data"`
}
type safetyReportListResponse struct {
	Data []safety.Report `json:"data"`
	Meta struct {
		Count int `json:"count"`
	} `json:"meta"`
}

func (api *API) createSafetyReport(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	var input safety.Input
	if !decodeSafetyBody(writer, request, &input, "Provide one valid safety report.") {
		return
	}
	result, err := api.safety.Create(request.Context(), user.ID, input)
	if api.writeSafetyError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusCreated, safetyReportReceiptResponse{Data: safetyReportReceipt{
		ID: result.ID, TargetKind: result.TargetKind, TargetID: result.TargetID,
		Category: result.Category, Status: result.Status, CreatedAt: result.CreatedAt,
	}})
}

func (api *API) listModerationReports(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	results, err := api.safety.ListForModerator(request.Context(), user.ID)
	if api.writeSafetyError(writer, err) {
		return
	}
	response := safetyReportListResponse{Data: results}
	response.Meta.Count = len(results)
	writeJSON(writer, http.StatusOK, response)
}

func (api *API) decideModerationReport(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	var input safety.DecisionInput
	if !decodeSafetyBody(writer, request, &input, "Provide one valid moderation decision.") {
		return
	}
	result, err := api.safety.Decide(request.Context(), user.ID, request.PathValue("reportId"), input)
	if api.writeSafetyError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusOK, safetyReportResponse{Data: result})
}

func decodeSafetyBody(writer http.ResponseWriter, request *http.Request, destination any, message string) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, maximumTrialProposalBody))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: message})
		return false
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: message})
		return false
	}
	return true
}

func (api *API) writeSafetyError(writer http.ResponseWriter, err error) bool {
	if err == nil {
		return false
	}
	var fieldError *safety.FieldError
	switch {
	case errors.As(err, &fieldError):
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_safety_report", Message: fieldError.Message, Field: fieldError.Field})
	case errors.Is(err, safety.ErrModeratorForbidden):
		writeError(writer, http.StatusForbidden, apiError{Code: "moderator_access_forbidden", Message: "Moderator access is required."})
	case errors.Is(err, safety.ErrReportUnavailable):
		writeError(writer, http.StatusConflict, apiError{Code: "safety_report_unavailable", Message: "This item cannot be reported by the current member, or a report already exists."})
	case errors.Is(err, safety.ErrDecisionUnavailable):
		writeError(writer, http.StatusConflict, apiError{Code: "moderation_decision_unavailable", Message: "This report cannot be decided."})
	default:
		api.logger.Error("manage safety report failed", "error", err)
		writeError(writer, http.StatusInternalServerError, apiError{Code: "internal_error", Message: "The safety report request could not be completed."})
	}
	return true
}
