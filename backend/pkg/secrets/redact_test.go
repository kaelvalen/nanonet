package secrets

import "testing"

func TestRedactURL(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"", ""},
		{"redis://localhost:6379", "redis://localhost:6379"},
		{"redis://localhost:6379/0", "redis://localhost:6379/0"},
		{"redis://:supersecret@redis:6379/0", "redis://:***@redis:6379/0"},
		{"redis://user:pass@redis:6379", "redis://user:***@redis:6379"},
		{"postgres://u:p@db:5432/nn?sslmode=disable", "postgres://u:***@db:5432/nn?sslmode=disable"},
	}
	for _, c := range cases {
		got := RedactURL(c.in)
		if got != c.want {
			t.Errorf("RedactURL(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestRedactURL_BogusInputDoesNotLeak(t *testing.T) {
	// Şemasız "user:pass@host" gibi inputlar. Parse edilse bile hiçbir
	// şekilde orijinal döndürülmemeli.
	for _, in := range []string{
		"user:pass@host",
		"::::::",
	} {
		got := RedactURL(in)
		if got == in {
			t.Errorf("RedactURL(%q) leaked input as-is", in)
		}
	}
}
