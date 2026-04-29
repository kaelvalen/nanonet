package middleware

import (
	"strings"
	"testing"
)

func TestSanitizeQuery_RedactsToken(t *testing.T) {
	q := sanitizeQuery("a=1&token=secret&b=2")
	if !strings.Contains(q, "token=%3Credacted%3E") {
		t.Fatalf("expected token redacted, got: %q", q)
	}
	if !strings.Contains(q, "a=1") || !strings.Contains(q, "b=2") {
		t.Fatalf("expected other params preserved, got: %q", q)
	}
}

func TestSanitizeQuery_UnparseableRedactsAll(t *testing.T) {
	q := sanitizeQuery("%zz")
	if q != "<redacted>" {
		t.Fatalf("expected <redacted>, got: %q", q)
	}
}
