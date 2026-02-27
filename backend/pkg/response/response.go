package response

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

// fieldLabels maps JSON field names to Turkish display names.
var fieldLabels = map[string]string{
	"email":             "E-posta",
	"password":          "Şifre",
	"new_password":      "Yeni Şifre",
	"current_password":  "Mevcut Şifre",
	"name":              "Servis Adı",
	"host":              "Host",
	"port":              "Port",
	"health_endpoint":   "Sağlık Endpoint'i",
	"poll_interval_sec": "Kontrol Aralığı",
	"command":           "Komut",
	"instances":         "Örnek Sayısı",
	"token":             "Token",
}

func fieldLabel(f string) string {
	key := strings.ToLower(f)
	if label, ok := fieldLabels[key]; ok {
		return label
	}
	return f
}

// translateTag converts a validator tag + field + param into a Turkish message.
func translateTag(field, tag, param string) string {
	label := fieldLabel(field)
	switch tag {
	case "required":
		return fmt.Sprintf("%s zorunludur", label)
	case "email":
		return fmt.Sprintf("%s geçerli bir e-posta adresi olmalıdır", label)
	case "min":
		return fmt.Sprintf("%s en az %s karakter olmalıdır", label, param)
	case "max":
		return fmt.Sprintf("%s en fazla %s karakter olabilir", label, param)
	case "gte":
		return fmt.Sprintf("%s en az %s olmalıdır", label, param)
	case "lte":
		return fmt.Sprintf("%s en fazla %s olabilir", label, param)
	case "url":
		return fmt.Sprintf("%s geçerli bir URL olmalıdır", label)
	case "ip":
		return fmt.Sprintf("%s geçerli bir IP adresi olmalıdır", label)
	case "startswith":
		return fmt.Sprintf("%s '%s' ile başlamalıdır", label, param)
	case "oneof":
		return fmt.Sprintf("%s geçersiz değer", label)
	default:
		return fmt.Sprintf("%s geçersiz (%s)", label, tag)
	}
}

// ValidationError parses a go-playground/validator error and returns a friendly Turkish message.
func ValidationError(c *gin.Context, err error) {
	var ve validator.ValidationErrors
	if ok := isValidationErrors(err, &ve); ok {
		msgs := make([]string, 0, len(ve))
		for _, fe := range ve {
			msgs = append(msgs, translateTag(fe.Field(), fe.Tag(), fe.Param()))
		}
		BadRequest(c, strings.Join(msgs, "; "))
		return
	}
	BadRequest(c, "Geçersiz istek gövdesi")
}

func isValidationErrors(err error, ve *validator.ValidationErrors) bool {
	cast, ok := err.(validator.ValidationErrors)
	if ok {
		*ve = cast
	}
	return ok
}

type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Success: true,
		Data:    data,
	})
}

func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, Response{
		Success: true,
		Data:    data,
	})
}

func Error(c *gin.Context, statusCode int, message string) {
	c.JSON(statusCode, Response{
		Success: false,
		Error:   message,
	})
}

func BadRequest(c *gin.Context, message string) {
	Error(c, http.StatusBadRequest, message)
}

func Unauthorized(c *gin.Context, message string) {
	Error(c, http.StatusUnauthorized, message)
}

func Forbidden(c *gin.Context, message string) {
	Error(c, http.StatusForbidden, message)
}

func NotFound(c *gin.Context, message string) {
	Error(c, http.StatusNotFound, message)
}

func InternalError(c *gin.Context, message string) {
	Error(c, http.StatusInternalServerError, message)
}
