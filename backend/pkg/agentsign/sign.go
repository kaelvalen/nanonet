// Package agentsign — backend ↔ agent komut wire-format'ında HMAC-SHA256
// imzalama yardımcıları.
//
// Tasarım, Rust agent tarafındaki `nanonet_agent::sign` modülü ile birebir
// uyumludur. Canonical imza-altı string:
//
//	"{command_id}|{action}|{nonce}|{payload}"
//
// `payload`, `command` alanı (yoksa boş string).
//
// ## Kullanım
//
//	signer := agentsign.NewFromEnv() // NANONET_AGENT_SIGN_SECRET
//	if signer.IsEnabled() {
//	    signer.SignInPlace(commandMap)
//	}
//
// `SignInPlace` map'e `nonce` ve `signature` alanlarını ekler. Eğer agent
// tarafı imzalama zorunlu değilse (`IsEnabled() == false`) hiçbir şey yapmaz.
package agentsign

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"

	"github.com/google/uuid"
)

// EnvVar — paylaşılan secret için tutarlı env adı.
const EnvVar = "NANONET_AGENT_SIGN_SECRET"

// Signer — opsiyonel HMAC imzalama. Secret boşsa no-op davranır.
type Signer struct {
	secret []byte
}

// New — verilen secret ile signer üretir. Secret boşsa imzalama devre dışı.
func New(secret string) *Signer {
	if secret == "" {
		return &Signer{}
	}
	return &Signer{secret: []byte(secret)}
}

// NewFromEnv — [EnvVar] env değişkeninden secret okuyarak signer kurar.
func NewFromEnv() *Signer {
	return New(os.Getenv(EnvVar))
}

// IsEnabled — secret yapılandırılmış mı?
func (s *Signer) IsEnabled() bool {
	return s != nil && len(s.secret) > 0
}

// canonical — agent ile birebir aynı string. Asla değiştirme.
func canonical(commandID, action, nonce, payload string) string {
	return fmt.Sprintf("%s|%s|%s|%s", commandID, action, nonce, payload)
}

// Sign — tek bir komut için (nonce, signatureHex) üretir. nonce parametresi
// boşsa yeni bir UUID atanır.
func (s *Signer) Sign(commandID, action, nonce, payload string) (string, string) {
	if !s.IsEnabled() {
		return "", ""
	}
	if nonce == "" {
		nonce = uuid.NewString()
	}
	mac := hmac.New(sha256.New, s.secret)
	_, _ = mac.Write([]byte(canonical(commandID, action, nonce, payload)))
	return nonce, hex.EncodeToString(mac.Sum(nil))
}

// SignInPlace — `command_id`, `action` ve opsiyonel `command` alanları olan
// map'e nonce + signature ekler. Eksik alanlarda hiçbir şey yapmaz.
func (s *Signer) SignInPlace(cmd map[string]interface{}) {
	if !s.IsEnabled() || cmd == nil {
		return
	}
	commandID, _ := cmd["command_id"].(string)
	action, _ := cmd["action"].(string)
	if commandID == "" || action == "" {
		return
	}
	payload, _ := cmd["command"].(string)
	nonce, sig := s.Sign(commandID, action, "", payload)
	cmd["nonce"] = nonce
	cmd["signature"] = sig
}
