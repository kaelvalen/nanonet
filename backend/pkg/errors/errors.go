package errors

import (
	"fmt"
)

// AppError represents an application error with context
type AppError struct {
	Code    string
	Message string
	Err     error
	Context map[string]interface{}
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s (caused by: %v)", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *AppError) Unwrap() error {
	return e.Err
}

// New creates a new AppError
func New(code, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Context: make(map[string]interface{}),
	}
}

// Wrap wraps an existing error with additional context
func Wrap(err error, code, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Err:     err,
		Context: make(map[string]interface{}),
	}
}

// With adds context to the error
func (e *AppError) With(key string, value interface{}) *AppError {
	e.Context[key] = value
	return e
}

// Common error codes
const (
	ErrCodeDatabase     = "DATABASE_ERROR"
	ErrCodeValidation   = "VALIDATION_ERROR"
	ErrCodeNotFound     = "NOT_FOUND"
	ErrCodeUnauthorized = "UNAUTHORIZED"
	ErrCodeForbidden    = "FORBIDDEN"
	ErrCodeConflict     = "CONFLICT"
	ErrCodeInternal     = "INTERNAL_ERROR"
	ErrCodeExternal     = "EXTERNAL_ERROR"
	ErrCodeRateLimit    = "RATE_LIMIT_EXCEEDED"
	ErrCodeTimeout      = "TIMEOUT"
)
