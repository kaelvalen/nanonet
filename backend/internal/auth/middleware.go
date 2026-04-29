package auth

import (
	"context"
	"strings"

	"nanonet-backend/pkg/response"
	"nanonet-backend/pkg/tokenblacklist"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// APITokenAuthenticator decouples the auth middleware from the apitokens
// package to avoid an import cycle. NewMiddleware takes a nil for purely
// JWT-based deployments; main.go wires in the real implementation.
type APITokenAuthenticator interface {
	Authenticate(ctx context.Context, secret string) (userID uuid.UUID, scopes []string, ok bool)
}

type Middleware struct {
	service         *Service
	blacklist       tokenblacklist.Blacklist
	apiTokens       APITokenAuthenticator
	allowQueryToken bool
}

func NewMiddleware(jwtSecret string, bl tokenblacklist.Blacklist, allowQueryToken bool) *Middleware {
	return &Middleware{
		service:         &Service{jwtSecret: jwtSecret},
		blacklist:       bl,
		allowQueryToken: allowQueryToken,
	}
}

// SetAPITokenAuthenticator enables API token (Bearer nn_…) auth on the
// protected routes. Optional — when not set, only JWTs are accepted.
func (m *Middleware) SetAPITokenAuthenticator(a APITokenAuthenticator) {
	m.apiTokens = a
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
			if m.allowQueryToken {
				tokenString = c.Query("token")
			}
		}

		if tokenString == "" {
			response.Unauthorized(c, "authorization gerekli")
			c.Abort()
			return
		}

		// Personal API tokens use the "nn_" sentinel and are checked first so
		// they short-circuit JWT parsing.
		if m.apiTokens != nil && strings.HasPrefix(tokenString, "nn_") {
			userID, scopes, ok := m.apiTokens.Authenticate(c.Request.Context(), tokenString)
			if !ok {
				response.Unauthorized(c, "geçersiz veya iptal edilmiş API token")
				c.Abort()
				return
			}
			c.Set("user_id", userID.String())
			c.Set("auth_kind", "api_token")
			c.Set("token_scopes", scopes)
			c.Next()
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
		c.Set("auth_kind", "jwt")
		c.Set("token", tokenString)
		c.Next()
	}
}

// RequireScope returns middleware that enforces a scope on the request when
// authentication came from an API token. JWT-authenticated UI users bypass
// scope checks (they have full access by definition).
func (m *Middleware) RequireScope(scope string) gin.HandlerFunc {
	return func(c *gin.Context) {
		kind, _ := c.Get("auth_kind")
		if kind == "jwt" || kind == nil {
			c.Next()
			return
		}
		raw, _ := c.Get("token_scopes")
		scopes, _ := raw.([]string)
		for _, s := range scopes {
			if s == "*" || s == scope {
				c.Next()
				return
			}
		}
		response.Unauthorized(c, "API token bu işlem için "+scope+" scope'una sahip değil")
		c.Abort()
	}
}
