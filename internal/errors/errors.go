package errors

import (
	"errors"
	"fmt"
	"net/http"
)

type Code string

const (
	CodeUnauthorized    Code = "UNAUTHORIZED"
	CodeForbidden       Code = "FORBIDDEN"
	CodeValidationError Code = "VALIDATION_ERROR"
	CodeNotFound        Code = "NOT_FOUND"
	CodeRateLimited     Code = "RATE_LIMITED"
	CodeInternal        Code = "INTERNAL_ERROR"
)

type AppError struct {
	Code    Code
	Message string
	Field   string
	Err     error
}

func (e *AppError) Error() string {
	if e == nil {
		return ""
	}
	if e.Field != "" {
		return fmt.Sprintf("%s: %s (%s)", e.Code, e.Message, e.Field)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *AppError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

func New(code Code, message string) *AppError {
	return &AppError{Code: code, Message: message}
}

func Wrap(code Code, message string, err error) *AppError {
	return &AppError{Code: code, Message: message, Err: err}
}

func WithField(err *AppError, field string) *AppError {
	if err == nil {
		return nil
	}
	copy := *err
	copy.Field = field
	return &copy
}

func StatusCode(err error) int {
	var appErr *AppError
	if errors.As(err, &appErr) {
		switch appErr.Code {
		case CodeUnauthorized:
			return http.StatusUnauthorized
		case CodeForbidden:
			return http.StatusForbidden
		case CodeValidationError:
			return http.StatusBadRequest
		case CodeNotFound:
			return http.StatusNotFound
		case CodeRateLimited:
			return http.StatusTooManyRequests
		default:
			return http.StatusInternalServerError
		}
	}
	return http.StatusInternalServerError
}
