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
		var tokenString string

		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenString = parts[1]
			}
		}

		if tokenString == "" {
			tokenString = c.Query("token")
		}

		if tokenString == "" {
			response.Unauthorized(c, "authorization gerekli")
			c.Abort()
			return
		}

		userID, err := m.service.ValidateToken(tokenString)
		if err != nil {
			response.Unauthorized(c, "geçersiz token")
			c.Abort()
			return
		}

		c.Set("user_id", userID.String())
		c.Next()
	}
}
