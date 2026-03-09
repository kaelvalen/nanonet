package ws

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Handler struct {
	hub            *Hub
	jwtSecret      string
	allowedOrigins map[string]bool
	upgrader       websocket.Upgrader
}

func NewHandler(hub *Hub, jwtSecret string, frontendURL string) *Handler {
	allowed := map[string]bool{
		"http://localhost:3000": true,
		"http://localhost:5173": true,
		"http://localhost:4173": true,
	}
	if frontendURL != "" {
		allowed[frontendURL] = true
	}

	h := &Handler{
		hub:            hub,
		jwtSecret:      jwtSecret,
		allowedOrigins: allowed,
	}

	h.upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			// Agent bağlantıları Origin göndermeyebilir (native clients)
			if origin == "" {
				return true
			}
			return h.allowedOrigins[origin]
		},
	}

	return h
}

func (h *Handler) extractTokenType(tokenString string) string {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(h.jwtSecret), nil
	})
	if err != nil || !token.Valid {
		return ""
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return ""
	}
	typ, _ := claims["typ"].(string)
	return typ
}

func (h *Handler) Dashboard(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade hatası: %v", err)
		return
	}

	clientID := uuid.New().String()
	client := NewClient(clientID, DashboardClient, h.hub, conn)
	client.userID = userID
	h.hub.register <- client

	go client.WritePump()
	go client.ReadPump()
}

func (h *Handler) AgentConnect(c *gin.Context) {
	serviceID := c.Query("service_id")
	if serviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "service_id gerekli"})
		return
	}

	// Token'ı header veya query'den al ve tip kontrolü yap
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

	tokenType := h.extractTokenType(tokenString)
	if tokenType != "agent" && tokenType != "access" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "geçersiz token tipi: agent veya access token gerekli"})
		return
	}

	agentID := c.Query("agent_id")
	if agentID == "" {
		agentID = uuid.New().String()
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade hatası: %v", err)
		return
	}

	client := NewClient(agentID, AgentClient, h.hub, conn)
	client.serviceID = serviceID
	h.hub.register <- client

	go client.WritePump()
	go client.ReadPump()
}

func (h *Handler) ServiceStream(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	serviceID := c.Param("id")
	if serviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "service_id gerekli"})
		return
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade hatası: %v", err)
		return
	}

	clientID := uuid.New().String()
	client := NewClient(clientID, DashboardClient, h.hub, conn)
	client.userID = userID
	client.serviceID = serviceID
	h.hub.register <- client

	go client.WritePump()
	go client.ReadPump()
}
