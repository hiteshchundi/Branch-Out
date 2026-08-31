package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/hiteshchundi/branch-out/backend/internal/applications"
	"github.com/hiteshchundi/branch-out/backend/internal/profile"
)

const maximumApplicationBody = 64 << 10

type applicationResponse struct {
	Data applications.Application `json:"data"`
}

type ownerApplicationsResponse struct {
	Data []applications.OwnerApplication `json:"data"`
	Meta struct {
		Count int `json:"count"`
	} `json:"meta"`
}

func (api *API) listSubmittedApplications(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	results, err := api.applications.ListSubmittedForOwner(request.Context(), user.ID, request.PathValue("id"))
	if api.writeApplicationError(writer, err) {
		return
	}
	response := ownerApplicationsResponse{Data: results}
	response.Meta.Count = len(results)
	writeJSON(writer, http.StatusOK, response)
}

func (api *API) getOwnApplication(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	result, err := api.applications.GetOwn(request.Context(), user.ID, request.PathValue("id"))
	if api.writeApplicationError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusOK, applicationResponse{Data: result})
}

func (api *API) saveApplicationDraft(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	input, ok := decodeApplicationInput(writer, request)
	if !ok {
		return
	}
	result, err := api.applications.SaveDraft(request.Context(), user.ID, request.PathValue("id"), input)
	if api.writeApplicationError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusOK, applicationResponse{Data: result})
}

func (api *API) submitApplication(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	result, err := api.applications.Submit(request.Context(), user.ID, request.PathValue("id"))
	if api.writeApplicationError(writer, err) {
		return
	}
	writeJSON(writer, http.StatusOK, applicationResponse{Data: result})
}

func decodeApplicationInput(writer http.ResponseWriter, request *http.Request) (applications.Input, bool) {
	var input applications.Input
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, maximumApplicationBody))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide a valid application draft request."})
		return applications.Input{}, false
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide exactly one application draft request."})
		return applications.Input{}, false
	}
	return input, true
}

func (api *API) writeApplicationError(writer http.ResponseWriter, err error) bool {
	if err == nil {
		return false
	}
	var fieldError *applications.FieldError
	switch {
	case errors.As(err, &fieldError):
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_application", Message: fieldError.Message, Field: fieldError.Field})
	case errors.Is(err, profile.ErrNotFound):
		writeError(writer, http.StatusConflict, apiError{Code: "profile_required", Message: "Complete your account profile before saving an application."})
	case errors.Is(err, applications.ErrNotFound):
		writeError(writer, http.StatusNotFound, apiError{Code: "application_not_found", Message: "No application was found for this opening."})
	case errors.Is(err, applications.ErrUnavailable):
		writeError(writer, http.StatusConflict, apiError{Code: "application_unavailable", Message: "This application cannot be changed or submitted."})
	case errors.Is(err, applications.ErrReviewNotFound):
		writeError(writer, http.StatusNotFound, apiError{Code: "opening_not_found", Message: "This opening was not found."})
	default:
		api.logger.Error("manage application failed", "error", err)
		writeError(writer, http.StatusInternalServerError, apiError{Code: "internal_error", Message: "The application request could not be completed."})
	}
	return true
}
