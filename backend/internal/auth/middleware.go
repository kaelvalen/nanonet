package auth

import (
	"strings"

	"nanonet-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type Middleware struct {
	service *Service
}

func NewMiddleware(jwtSecret string) *Middleware {
	return &Middleware{
		service: &Service{jwtSecret: jwtSecret},
	}
}

func (m *Middleware) Required() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Unauthorized(c, "authorization header eksik")
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			response.Unauthorized(c, "geçersiz authorization format")
			c.Abort()
			return
		}

		userID, err := m.service.ValidateToken(parts[1])
		if err != nil {
			response.Unauthorized(c, "geçersiz token")
			c.Abort()
			return
		}

		c.Set("user_id", userID.String())
		c.Next()
	}
}
