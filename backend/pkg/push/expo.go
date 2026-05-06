package push

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const defaultExpoURL = "https://exp.host/--/push/v2/send"

type Message struct {
	To    string `json:"to"`
	Title string `json:"title"`
	Body  string `json:"body"`
	Data  any    `json:"data,omitempty"`
}

type Client struct {
	http    *http.Client
	baseURL string
}

func NewClient() *Client {
	return &Client{
		http:    &http.Client{Timeout: 10 * time.Second},
		baseURL: defaultExpoURL,
	}
}

// BaseURL overrides the Expo Push API URL (for tests).
func (c *Client) BaseURL(u string) { c.baseURL = u }

func (c *Client) Send(ctx context.Context, messages []Message) error {
	payload, err := json.Marshal(messages)
	if err != nil {
		return fmt.Errorf("push marshal: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("push request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("push send: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("expo push HTTP %d", resp.StatusCode)
	}
	return nil
}
