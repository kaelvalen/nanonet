# NanoNet Backend

Go + Gin API. Dokümantasyon: [../docs/backend.md](../docs/backend.md).

**Swagger UI:** http://localhost:8080/api/docs (backend çalışırken)

```bash
go run cmd/main.go
go test ./...
air   # hot reload (.air.toml)
```

Migrations: `migrations/`. Config: kök `.env` veya `pkg/config`.
