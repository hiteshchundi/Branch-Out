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

type trialOutcomeResponse struct {
	Data trialproposals.Outcome `json:"data"`
}

type trialOutcomeDecisionRequest struct {
	Decision string `json:"decision"`
}

type trialFeedbackResponse struct {
	Data trialproposals.Feedback `json:"data"`
}

type trialFeedbackListResponse struct {
	Data []trialproposals.Feedback `json:"data"`
	Meta struct {
		Count int `json:"count"`
	} `json:"meta"`
}

type trialTrustCandidateResponse struct {
	Data trialproposals.TrustCandidate `json:"data"`
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

func (api *API) getTrialOutcome(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	result, err := api.trialProposals.GetOutcome(request.Context(), user.ID, request.PathValue("proposalId"))
	if api.writeTrialOutcomeError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusOK, trialOutcomeResponse{Data: result})
}

func (api *API) createTrialOutcome(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	var input trialproposals.OutcomeInput
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, maximumTrialProposalBody))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide a valid trial outcome."})
		return
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide exactly one trial outcome."})
		return
	}
	result, err := api.trialProposals.CreateOutcome(request.Context(), user.ID, request.PathValue("proposalId"), input)
	if api.writeTrialOutcomeError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusCreated, trialOutcomeResponse{Data: result})
}

func (api *API) decideTrialOutcome(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	var input trialOutcomeDecisionRequest
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, maximumTrialProposalBody))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide a confirmed or disputed outcome decision."})
		return
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide exactly one outcome decision."})
		return
	}
	result, err := api.trialProposals.DecideOutcome(request.Context(), user.ID, request.PathValue("proposalId"), input.Decision)
	if api.writeTrialOutcomeError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusOK, trialOutcomeResponse{Data: result})
}

func (api *API) writeTrialOutcomeError(writer http.ResponseWriter, err error) bool {
	if err == nil {
		return false
	}
	var fieldError *trialproposals.FieldError
	switch {
	case errors.As(err, &fieldError):
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_trial_outcome", Message: fieldError.Message, Field: fieldError.Field})
	case errors.Is(err, trialproposals.ErrOutcomeNotFound):
		writeError(writer, http.StatusNotFound, apiError{Code: "trial_outcome_not_found", Message: "No trial outcome is available to you."})
	case errors.Is(err, trialproposals.ErrOutcomeUnavailable):
		writeError(writer, http.StatusConflict, apiError{Code: "trial_outcome_unavailable", Message: "This trial outcome cannot be submitted."})
	case errors.Is(err, trialproposals.ErrOutcomeDecisionUnavailable):
		writeError(writer, http.StatusConflict, apiError{Code: "trial_outcome_decision_unavailable", Message: "This trial outcome cannot be decided."})
	default:
		api.logger.Error("manage trial outcome failed", "error", err)
		writeError(writer, http.StatusInternalServerError, apiError{Code: "internal_error", Message: "The trial outcome request could not be completed."})
	}
	return true
}

func (api *API) listTrialFeedback(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	results, err := api.trialProposals.ListFeedback(request.Context(), user.ID, request.PathValue("proposalId"))
	if api.writeTrialFeedbackError(writer, err) {
		return
	}
	response := trialFeedbackListResponse{Data: results}
	response.Meta.Count = len(results)
	writeJSON(writer, http.StatusOK, response)
}

func (api *API) createTrialFeedback(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	var input trialproposals.FeedbackInput
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, maximumTrialProposalBody))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide valid private trial feedback."})
		return
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide exactly one private trial feedback record."})
		return
	}
	result, err := api.trialProposals.CreateFeedback(request.Context(), user.ID, request.PathValue("proposalId"), input)
	if api.writeTrialFeedbackError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusCreated, trialFeedbackResponse{Data: result})
}

func (api *API) acknowledgeTrialFeedback(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	result, err := api.trialProposals.AcknowledgeFeedback(
		request.Context(), user.ID, request.PathValue("proposalId"), request.PathValue("feedbackId"),
	)
	if api.writeTrialFeedbackError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusOK, trialFeedbackResponse{Data: result})
}

func (api *API) writeTrialFeedbackError(writer http.ResponseWriter, err error) bool {
	if err == nil {
		return false
	}
	var fieldError *trialproposals.FieldError
	switch {
	case errors.As(err, &fieldError):
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_trial_feedback", Message: fieldError.Message, Field: fieldError.Field})
	case errors.Is(err, trialproposals.ErrFeedbackUnavailable):
		writeError(writer, http.StatusConflict, apiError{Code: "trial_feedback_unavailable", Message: "Private feedback is unavailable until the outcome is confirmed, or you already submitted feedback."})
	case errors.Is(err, trialproposals.ErrFeedbackAcknowledgeUnavailable):
		writeError(writer, http.StatusConflict, apiError{Code: "trial_feedback_acknowledgement_unavailable", Message: "This private feedback cannot be acknowledged."})
	default:
		api.logger.Error("manage trial feedback failed", "error", err)
		writeError(writer, http.StatusInternalServerError, apiError{Code: "internal_error", Message: "The private feedback request could not be completed."})
	}
	return true
}

func (api *API) getTrialTrustCandidate(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	result, err := api.trialProposals.GetTrustCandidate(request.Context(), user.ID, request.PathValue("proposalId"))
	if api.writeTrialOutcomeError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusOK, trialTrustCandidateResponse{Data: result})
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
