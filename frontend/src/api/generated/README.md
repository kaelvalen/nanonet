# OpenAPI üretilmiş tipler

```bash
npm run api:types
```

Kaynak: `backend/api/openapi.yaml`. Çıktı: `schema.ts` — isteğe bağlı import:

```typescript
import type { components } from "@/api/generated/schema";
type Service = components["schemas"]["Service"];
```

Mevcut el yazımı API client'lar (`src/api/*.ts`) korunur; tipler kademeli geçiş için kullanılabilir.
