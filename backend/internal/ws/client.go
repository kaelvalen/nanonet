package ws

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

type ClientType string

const (
	DashboardClient ClientType = "dashboard"
	AgentClient     ClientType = "agent"
)

type Client struct {
	id         string
	clientType ClientType
	serviceID  string
	userID     string
	hub        *Hub
	conn       *websocket.Conn
	send       chan []byte
}

func NewClient(id string, clientType ClientType, hub *Hub, conn *websocket.Conn) *Client {
	return &Client{
		id:         id,
		clientType: clientType,
		hub:        hub,
		conn:       conn,
		send:       make(chan []byte, 256),
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure, websocket.CloseNormalClosure) {
				log.Printf("WebSocket hatası [%s/%s]: %v", c.clientType, c.id, err)
			}
			break
		}

		if c.clientType == AgentClient {
			c.hub.HandleAgentMessage(c, message)
		} else {
			c.hub.HandleDashboardMessage(c, message)
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

			// Flush remaining queued messages as separate frames.
			n := len(c.send)
			for i := 0; i < n; i++ {
				if err := c.conn.WriteMessage(websocket.TextMessage, <-c.send); err != nil {
					return
				}
			}

		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) SendJSON(v interface{}) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	select {
	case c.send <- data:
		return nil
	default:
		return fmt.Errorf("client send buffer dolu, mesaj atlandı: %s", c.id)
	}
}
