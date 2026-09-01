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

type trialProposalListResponse struct {
	Data []trialproposals.OwnerProposal `json:"data"`
	Meta struct {
		Count int `json:"count"`
	} `json:"meta"`
}

type trialProposalDecisionRequest struct {
	Decision string `json:"decision"`
}

type trialCheckInResponse struct {
	Data trialproposals.CheckIn `json:"data"`
}

type trialCheckInListResponse struct {
	Data []trialproposals.CheckIn `json:"data"`
	Meta struct {
		Count int `json:"count"`
	} `json:"meta"`
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

func (api *API) sendOwnTrialProposal(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	result, err := api.trialProposals.SendOwn(request.Context(), user.ID, request.PathValue("id"))
	if api.writeTrialProposalError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusOK, trialProposalResponse{Data: result})
}

func (api *API) listTrialProposalsForOwner(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	results, err := api.trialProposals.ListForOwner(request.Context(), user.ID, request.PathValue("id"))
	if api.writeTrialProposalError(writer, err) {
		return
	}
	response := trialProposalListResponse{Data: results}
	response.Meta.Count = len(results)
	writeJSON(writer, http.StatusOK, response)
}

func (api *API) decideTrialProposal(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	var input trialProposalDecisionRequest
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, maximumTrialProposalBody))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide an accepted or declined trial proposal decision."})
		return
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide exactly one trial proposal decision."})
		return
	}
	result, err := api.trialProposals.Decide(
		request.Context(), user.ID, request.PathValue("id"), request.PathValue("proposalId"), input.Decision,
	)
	if api.writeTrialProposalError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusOK, trialProposalResponse{Data: result})
}

func (api *API) listTrialCheckIns(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	results, err := api.trialProposals.ListCheckIns(request.Context(), user.ID, request.PathValue("proposalId"))
	if api.writeTrialProposalError(writer, err) {
		return
	}
	response := trialCheckInListResponse{Data: results}
	response.Meta.Count = len(results)
	writeJSON(writer, http.StatusOK, response)
}

func (api *API) addTrialCheckIn(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	var input trialproposals.CheckInInput
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, maximumTrialProposalBody))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide a valid trial check-in."})
		return
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide exactly one trial check-in."})
		return
	}
	result, err := api.trialProposals.AddCheckIn(request.Context(), user.ID, request.PathValue("proposalId"), input)
	if api.writeTrialProposalError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusCreated, trialCheckInResponse{Data: result})
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
	case errors.Is(err, trialproposals.ErrSendUnavailable):
		writeError(writer, http.StatusConflict, apiError{Code: "trial_proposal_send_unavailable", Message: "Only a complete unsent proposal can be sent."})
	case errors.Is(err, trialproposals.ErrReviewNotFound):
		writeError(writer, http.StatusNotFound, apiError{Code: "trial_proposal_review_not_found", Message: "This opening is not available for trial proposal review."})
	case errors.Is(err, trialproposals.ErrDecisionUnavailable):
		writeError(writer, http.StatusConflict, apiError{Code: "trial_proposal_decision_unavailable", Message: "This trial proposal is not available for a decision."})
	case errors.Is(err, trialproposals.ErrWorkspaceNotFound):
		writeError(writer, http.StatusNotFound, apiError{Code: "trial_workspace_not_found", Message: "This accepted trial workspace is not available to you."})
	default:
		api.logger.Error("manage trial proposal failed", "error", err)
		writeError(writer, http.StatusInternalServerError, apiError{Code: "internal_error", Message: "The trial proposal request could not be completed."})
	}
	return true
}
