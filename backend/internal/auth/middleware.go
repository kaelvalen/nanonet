package auth

import (
	"strings"

	"nanonet-backend/pkg/response"
	"nanonet-backend/pkg/tokenblacklist"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type Middleware struct {
	service   *Service
	blacklist tokenblacklist.Blacklist
}

func NewMiddleware(jwtSecret string, bl tokenblacklist.Blacklist) *Middleware {
	return &Middleware{
		service:   &Service{jwtSecret: jwtSecret},
		blacklist: bl,
	}
}

// tokenTypeFromString — token string'inden tip alanını okur (imza doğrulanmadan).
// Güvenli kullanım için yalnızca reddetme kararlarında kullanılmalı;
// kabul kararları her zaman ValidateToken ile yapılır.
func (m *Middleware) tokenTypeFromString(tokenString string) string {
	token, _, _ := new(jwt.Parser).ParseUnverified(tokenString, jwt.MapClaims{})
	if token == nil {
		return ""
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return ""
	}
	typ, _ := claims["typ"].(string)
	return typ
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

		// Agent token'ları yalnızca WebSocket agent bağlantısı için kullanılabilir;
		// REST API endpoint'lerine erişim yasaktır.
		if m.tokenTypeFromString(tokenString) == "agent" {
			response.Unauthorized(c, "agent token REST API için geçersiz — lütfen access token kullanın")
			c.Abort()
			return
		}

		if m.blacklist.IsBlacklisted(c.Request.Context(), tokenString) {
			response.Unauthorized(c, "token geçersiz kılınmış, lütfen tekrar giriş yapın")
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
		c.Set("token", tokenString)
		c.Next()
	}
}
