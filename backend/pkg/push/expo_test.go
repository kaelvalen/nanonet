package push_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"nanonet-backend/pkg/push"
)

func TestClient_Send_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"data":[{"status":"ok"}]}`))
	}))
	defer srv.Close()

	c := push.NewClient()
	c.BaseURL(srv.URL)

	err := c.Send(context.Background(), []push.Message{
		{To: "ExponentPushToken[xxx]", Title: "Test", Body: "body"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestClient_Send_HTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer srv.Close()

	c := push.NewClient()
	c.BaseURL(srv.URL)

	err := c.Send(context.Background(), []push.Message{
		{To: "ExponentPushToken[xxx]", Title: "Test", Body: "body"},
	})
	if err == nil {
		t.Fatal("expected error for 400 response")
	}
}
