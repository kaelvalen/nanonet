# OpenAPI spec

**Tek kaynak:** `openapi.yaml`

| Dosya | Rol |
|-------|-----|
| `openapi.yaml` | Birleşik spec (auth, services, k8s, …) |
| `paths-extra.yaml` | İlk birleştirmede eklenen path'ler; sonrasında doğrudan `openapi.yaml` düzenleyin |

## Senkron

```bash
make openapi-sync
# veya: npm run openapi:sync
```

Kopyalar: `docs/api/openapi.yaml`, `pkg/apidocs/openapi.yaml` (Swagger UI embed).

## Swagger UI

Backend ayaktayken: http://localhost:8080/api/docs
