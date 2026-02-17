package ws

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Handler struct {
	hub *Hub
}

func NewHandler(hub *Hub) *Handler {
	return &Handler{hub: hub}
}

func (h *Handler) Dashboard(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
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

	agentID := c.Query("agent_id")
	if agentID == "" {
		agentID = uuid.New().String()
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
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

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
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
