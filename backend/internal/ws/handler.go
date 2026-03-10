package ws

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"nanonet-backend/pkg/ratelimit"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Handler struct {
	hub              *Hub
	jwtSecret        string
	allowedOrigins   map[string]bool
	upgrader         websocket.Upgrader
	dashboardLimiter *ratelimit.Limiter
	agentLimiter     *ratelimit.Limiter
}

func NewHandler(hub *Hub, jwtSecret string, frontendURL string) *Handler {
	allowed := map[string]bool{}
	if frontendURL != "" {
		allowed[frontendURL] = true
	}
	// Geliştirme ortamı için localhost origin'leri (üretimde GIN_MODE=release ayarlanmalı)
	if gin.Mode() != gin.ReleaseMode {
		allowed["http://localhost:3000"] = true
		allowed["http://localhost:5173"] = true
		allowed["http://localhost:4173"] = true
	}

	h := &Handler{
		hub:              hub,
		jwtSecret:        jwtSecret,
		allowedOrigins:   allowed,
		dashboardLimiter: ratelimit.New(10, time.Minute),
		agentLimiter:     ratelimit.New(5, time.Minute),
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

// validateUserToken imzayı doğrular ve user_id'yi döndürür.
// Sadece "access" ve "refresh" türündeki tokenları kabul eder (agent token reddedilir).
func (h *Handler) validateUserToken(tokenString string) (string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(h.jwtSecret), nil
	})
	if err != nil || !token.Valid {
		return "", errors.New("geçersiz token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", errors.New("geçersiz token claims")
	}
	if typ, _ := claims["typ"].(string); typ == "agent" {
		return "", errors.New("agent token dashboard bağlantısı için kullanılamaz")
	}
	userID, ok := claims["sub"].(string)
	if !ok || userID == "" {
		return "", errors.New("token'da kullanıcı ID eksik")
	}
	return userID, nil
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
	ip := c.ClientIP()
	if !h.dashboardLimiter.Allow(ip) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many WebSocket connections — please wait"})
		return
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade hatası: %v", err)
		return
	}

	// İlk mesaj ile kimlik doğrulama (token URL'de taşınmaz)
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	_, rawMsg, err := conn.ReadMessage()
	if err != nil {
		conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(4401, "authentication required"))
		conn.Close()
		return
	}
	conn.SetReadDeadline(time.Time{})

	var authMsg struct {
		Type  string `json:"type"`
		Token string `json:"token"`
	}
	if jsonErr := json.Unmarshal(rawMsg, &authMsg); jsonErr != nil || authMsg.Type != "auth" || authMsg.Token == "" {
		conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(4401, "invalid auth message"))
		conn.Close()
		return
	}

	userID, err := h.validateUserToken(authMsg.Token)
	if err != nil {
		conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(4401, "unauthorized"))
		conn.Close()
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

	if tokenString == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "token gerekli"})
		return
	}

	tokenType := h.extractTokenType(tokenString)
	if tokenType != "agent" && tokenType != "access" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "geçersiz token tipi: agent veya access token gerekli"})
		return
	}

	ip := c.ClientIP()
	if !h.agentLimiter.Allow(ip) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many agent connections — please wait"})
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
	ip := c.ClientIP()
	if !h.dashboardLimiter.Allow(ip) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many WebSocket connections — please wait"})
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

	// İlk mesaj ile kimlik doğrulama
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	_, rawMsg, err := conn.ReadMessage()
	if err != nil {
		conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(4401, "authentication required"))
		conn.Close()
		return
	}
	conn.SetReadDeadline(time.Time{})

	var authMsg struct {
		Type  string `json:"type"`
		Token string `json:"token"`
	}
	if jsonErr := json.Unmarshal(rawMsg, &authMsg); jsonErr != nil || authMsg.Type != "auth" || authMsg.Token == "" {
		conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(4401, "invalid auth message"))
		conn.Close()
		return
	}

	userID, err := h.validateUserToken(authMsg.Token)
	if err != nil {
		conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(4401, "unauthorized"))
		conn.Close()
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
