package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/hiteshchundi/branch-out/backend/internal/openings"
	"github.com/hiteshchundi/branch-out/backend/internal/profile"
)

const maximumOpeningBody = 64 << 10

type managedOpeningResponse struct {
	Data openings.ManagedOpening `json:"data"`
}
type managedOpeningsResponse struct {
	Data []openings.ManagedOpening `json:"data"`
	Meta struct {
		Count int `json:"count"`
	} `json:"meta"`
}

func (api *API) listOwnedOpenings(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	results, err := api.openingManager.ListOwned(request.Context(), user.ID)
	if err != nil {
		api.logger.Error("list owned openings failed", "error", err)
		writeError(writer, http.StatusInternalServerError, apiError{Code: "internal_error", Message: "Your opening drafts could not be loaded."})
		return
	}
	response := managedOpeningsResponse{Data: results}
	response.Meta.Count = len(results)
	writeJSON(writer, http.StatusOK, response)
}

func (api *API) createOpeningDraft(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	input, ok := decodeOpeningInput(writer, request)
	if !ok {
		return
	}
	result, err := api.openingManager.CreateDraft(request.Context(), user.ID, input)
	if api.writeOpeningManagementError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusCreated, managedOpeningResponse{Data: result})
}

func (api *API) updateOpeningDraft(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	input, ok := decodeOpeningInput(writer, request)
	if !ok {
		return
	}
	result, err := api.openingManager.UpdateDraft(request.Context(), user.ID, request.PathValue("id"), input)
	if api.writeOpeningManagementError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusOK, managedOpeningResponse{Data: result})
}

func (api *API) publishOpeningDraft(writer http.ResponseWriter, request *http.Request) {
	api.transitionOpening(writer, request, api.openingManager.PublishDraft)
}

func (api *API) closeOpening(writer http.ResponseWriter, request *http.Request) {
	api.transitionOpening(writer, request, api.openingManager.CloseOpening)
}

func (api *API) transitionOpening(
	writer http.ResponseWriter,
	request *http.Request,
	transition func(context.Context, int64, string) (openings.ManagedOpening, error),
) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	result, err := transition(request.Context(), user.ID, request.PathValue("id"))
	if api.writeOpeningManagementError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusOK, managedOpeningResponse{Data: result})
}

func decodeOpeningInput(writer http.ResponseWriter, request *http.Request) (openings.DraftInput, bool) {
	var input openings.DraftInput
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, maximumOpeningBody))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide a valid opening draft request."})
		return openings.DraftInput{}, false
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide exactly one opening draft request."})
		return openings.DraftInput{}, false
	}
	return input, true
}

func (api *API) writeOpeningManagementError(writer http.ResponseWriter, err error) bool {
	if err == nil {
		return false
	}
	var fieldError *openings.DraftFieldError
	switch {
	case errors.As(err, &fieldError):
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_opening", Message: fieldError.Message, Field: fieldError.Field})
	case errors.Is(err, profile.ErrNotFound):
		writeError(writer, http.StatusConflict, apiError{Code: "profile_required", Message: "Complete your account profile before saving an opening."})
	case errors.Is(err, openings.ErrDraftNotFound):
		writeError(writer, http.StatusNotFound, apiError{Code: "opening_draft_not_found", Message: "That editable opening draft was not found."})
	case errors.Is(err, openings.ErrTransitionNotFound):
		writeError(writer, http.StatusNotFound, apiError{Code: "opening_transition_not_found", Message: "That opening is not available for this lifecycle change."})
	default:
		api.logger.Error("manage opening failed", "error", err)
		writeError(writer, http.StatusInternalServerError, apiError{Code: "internal_error", Message: "The opening request could not be completed."})
	}
	return true
}
