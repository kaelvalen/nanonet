package runbooks

import "testing"

func TestMeetsSeverity(t *testing.T) {
	cases := []struct {
		actual string
		min    string
		want   bool
	}{
		{"info", "info", true},
		{"warn", "info", true},
		{"crit", "warn", true},
		{"info", "warn", false},
		{"warn", "crit", false},
		{"critical", "warn", true},
		{"warning", "warn", true},
		{"", "info", false},
	}
	for _, tc := range cases {
		if got := meetsSeverity(tc.actual, tc.min); got != tc.want {
			t.Fatalf("meetsSeverity(%q,%q) = %v, want %v", tc.actual, tc.min, got, tc.want)
		}
	}
}
