package agentsign

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"testing"
)

func TestDisabledSignerNoOp(t *testing.T) {
	s := New("")
	if s.IsEnabled() {
		t.Fatalf("boş secret enabled olmamalı")
	}
	cmd := map[string]interface{}{"command_id": "x", "action": "ping"}
	s.SignInPlace(cmd)
	if _, ok := cmd["nonce"]; ok {
		t.Fatalf("disabled signer nonce eklememeli")
	}
	if _, ok := cmd["signature"]; ok {
		t.Fatalf("disabled signer signature eklememeli")
	}
}

func TestSignDeterministic(t *testing.T) {
	s := New("topsecret")
	if !s.IsEnabled() {
		t.Fatalf("secret verildi, enabled olmalı")
	}
	nonce, sig := s.Sign("c", "exec", "n-fixed", "uptime")

	// Manuel hesap ile karşılaştır.
	mac := hmac.New(sha256.New, []byte("topsecret"))
	mac.Write([]byte("c|exec|n-fixed|uptime"))
	expected := hex.EncodeToString(mac.Sum(nil))
	if sig != expected {
		t.Fatalf("imza beklenenle uyuşmadı:\n  got = %s\n  exp = %s", sig, expected)
	}
	if nonce != "n-fixed" {
		t.Fatalf("verilen nonce korunmalıydı, got=%q", nonce)
	}
}

func TestSignAutogeneratesNonce(t *testing.T) {
	s := New("topsecret")
	n1, _ := s.Sign("c", "ping", "", "")
	n2, _ := s.Sign("c", "ping", "", "")
	if n1 == "" || n2 == "" {
		t.Fatalf("auto nonce üretilmeli")
	}
	if n1 == n2 {
		t.Fatalf("auto nonce benzersiz olmalı")
	}
	if !strings.Contains(n1, "-") {
		t.Fatalf("UUID benzeri olmalı, got=%q", n1)
	}
}

func TestSignInPlaceFillsFields(t *testing.T) {
	s := New("topsecret")
	cmd := map[string]interface{}{
		"command_id": "c",
		"action":     "exec",
		"command":    "uptime",
	}
	s.SignInPlace(cmd)
	nonce, ok := cmd["nonce"].(string)
	if !ok || nonce == "" {
		t.Fatalf("nonce eklenmedi")
	}
	sig, ok := cmd["signature"].(string)
	if !ok || sig == "" {
		t.Fatalf("signature eklenmedi")
	}
	// Türetilen imza, manuel hesapla aynı olmalı.
	mac := hmac.New(sha256.New, []byte("topsecret"))
	mac.Write([]byte("c|exec|" + nonce + "|uptime"))
	if sig != hex.EncodeToString(mac.Sum(nil)) {
		t.Fatalf("SignInPlace ile üretilen imza canonical eşleşmedi")
	}
}

func TestSignInPlaceIgnoresIncompleteCommand(t *testing.T) {
	s := New("topsecret")
	cmd := map[string]interface{}{"command_id": ""}
	s.SignInPlace(cmd)
	if _, ok := cmd["signature"]; ok {
		t.Fatalf("eksik command_id için imza atılmamalıydı")
	}
}
