package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/hiteshchundi/branch-out/backend/internal/trialproposals"
)

const maximumTrialProposalBody = 64 << 10

type trialProposalResponse struct {
	Data trialproposals.Proposal `json:"data"`
}

func (api *API) getOwnTrialProposal(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	result, err := api.trialProposals.GetOwn(request.Context(), user.ID, request.PathValue("id"))
	if api.writeTrialProposalError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusOK, trialProposalResponse{Data: result})
}

func (api *API) saveOwnTrialProposal(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	var input trialproposals.Input
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, maximumTrialProposalBody))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide a valid trial proposal draft."})
		return
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide exactly one trial proposal draft."})
		return
	}
	result, err := api.trialProposals.SaveOwnDraft(request.Context(), user.ID, request.PathValue("id"), input)
	if api.writeTrialProposalError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusOK, trialProposalResponse{Data: result})
}

func (api *API) writeTrialProposalError(writer http.ResponseWriter, err error) bool {
	if err == nil {
		return false
	}
	var fieldError *trialproposals.FieldError
	switch {
	case errors.As(err, &fieldError):
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_trial_proposal", Message: fieldError.Message, Field: fieldError.Field})
	case errors.Is(err, trialproposals.ErrNotFound):
		writeError(writer, http.StatusNotFound, apiError{Code: "trial_proposal_not_found", Message: "No trial proposal was found for this opening."})
	case errors.Is(err, trialproposals.ErrUnavailable):
		writeError(writer, http.StatusConflict, apiError{Code: "trial_proposal_unavailable", Message: "An accepted application is required to save this trial proposal."})
	default:
		api.logger.Error("manage trial proposal failed", "error", err)
		writeError(writer, http.StatusInternalServerError, apiError{Code: "internal_error", Message: "The trial proposal request could not be completed."})
	}
	return true
}
