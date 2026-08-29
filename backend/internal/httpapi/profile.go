package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/hiteshchundi/branch-out/backend/internal/profile"
)

const maximumProfileBody = 64 << 10

type profileResponse struct {
	Data profile.Profile `json:"data"`
}

func (api *API) getProfile(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}
	result, err := api.profiles.Get(request.Context(), user.ID)
	if errors.Is(err, profile.ErrNotFound) {
		writeError(writer, http.StatusNotFound, apiError{Code: "profile_not_found", Message: "Complete your profile to create it."})
		return
	}
	if err != nil {
		api.logger.Error("load profile failed", "error", err)
		writeError(writer, http.StatusInternalServerError, apiError{Code: "internal_error", Message: "The profile could not be loaded."})
		return
	}
	writeJSON(writer, http.StatusOK, profileResponse{Data: result})
}

func (api *API) putProfile(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	user, ok := api.requireUser(writer, request)
	if !ok {
		return
	}

	var input profile.Input
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, maximumProfileBody))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide a valid profile request."})
		return
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_request", Message: "Provide exactly one profile request."})
		return
	}

	result, err := api.profiles.Save(request.Context(), user.ID, input)
	var fieldError *profile.FieldError
	if errors.As(err, &fieldError) {
		writeError(writer, http.StatusBadRequest, apiError{Code: "invalid_profile", Message: fieldError.Message, Field: fieldError.Field})
		return
	}
	if err != nil {
		api.logger.Error("save profile failed", "error", err)
		writeError(writer, http.StatusInternalServerError, apiError{Code: "internal_error", Message: "The profile could not be saved."})
		return
	}
	writeJSON(writer, http.StatusOK, profileResponse{Data: result})
}
