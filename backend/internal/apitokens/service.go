package apitokens

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SecretPrefix is the human-friendly sentinel that lets git-secret scanners
// detect leaked NanoNet API tokens.
const SecretPrefix = "nn_"

// SecretBytes controls token entropy. 32 random bytes → 64 hex chars.
const SecretBytes = 32

// PrefixDisplayLen is how much of the secret we keep around for UI listing
// (after the "nn_" sentinel).
const PrefixDisplayLen = 8

type Service struct {
	repo *Repository
}

func NewService(db *gorm.DB) *Service {
	return &Service{repo: NewRepository(db)}
}

// Repo exposes the underlying repository for handlers that need direct access.
func (s *Service) Repo() *Repository { return s.repo }

// Create issues a new API token. The plaintext secret is returned exactly once
// in the response; the database stores only its SHA-256 hash.
func (s *Service) Create(ctx context.Context, userID uuid.UUID, req CreateRequest) (*CreateResponse, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, errors.New("name boş olamaz")
	}
	if len(req.Scopes) == 0 {
		return nil, errors.New("en az bir scope seçilmeli")
	}
	for _, sc := range req.Scopes {
		if !IsValidScope(sc) {
			return nil, errors.New("geçersiz scope: " + sc)
		}
	}

	secret, err := generateSecret()
	if err != nil {
		return nil, err
	}

	hash := hashSecret(secret)
	prefix := secret[:len(SecretPrefix)+PrefixDisplayLen]

	tok := &Token{
		ID:        uuid.New(),
		UserID:    userID,
		Name:      name,
		Prefix:    prefix,
		TokenHash: hash,
		Scopes:    ToStringArray(dedupe(req.Scopes)),
		CreatedAt: time.Now(),
	}
	if req.ExpiresIn > 0 {
		exp := time.Now().Add(time.Duration(req.ExpiresIn) * 24 * time.Hour)
		tok.ExpiresAt = &exp
	}

	if err := s.repo.Create(ctx, tok); err != nil {
		return nil, err
	}

	return &CreateResponse{Token: *tok, Secret: secret}, nil
}

// Authenticate validates a presented secret and returns the owning userID and
// the token's scopes. Returns nil if the secret is unknown, revoked, or expired.
func (s *Service) Authenticate(ctx context.Context, secret string) (*Token, error) {
	if !strings.HasPrefix(secret, SecretPrefix) {
		return nil, nil //nolint:nilnil
	}
	hash := hashSecret(secret)
	t, err := s.repo.FindActiveByHash(ctx, hash)
	if err != nil || t == nil {
		return nil, err
	}
	// Async last-used touch — don't block the request path.
	go s.repo.TouchLastUsed(context.Background(), t.ID)
	return t, nil
}

// HasScope returns true if the given scopes slice contains the required scope
// (or a wildcard "*").
func HasScope(have []string, need string) bool {
	for _, s := range have {
		if s == "*" || s == need {
			return true
		}
	}
	return false
}

func generateSecret() (string, error) {
	buf := make([]byte, SecretBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return SecretPrefix + hex.EncodeToString(buf), nil
}

func hashSecret(secret string) string {
	h := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(h[:])
}

func dedupe(in []string) []string {
	seen := make(map[string]struct{}, len(in))
	out := make([]string, 0, len(in))
	for _, v := range in {
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}
