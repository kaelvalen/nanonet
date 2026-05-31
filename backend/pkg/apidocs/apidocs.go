// Package apidocs serves the OpenAPI specification and Swagger UI.
package apidocs

import (
	"embed"
	"net/http"

	"github.com/gin-gonic/gin"
)

//go:embed openapi.yaml docs.html
var files embed.FS

// Register mounts public API documentation routes on the router.
func Register(r *gin.Engine) {
	r.GET("/api/openapi.yaml", func(c *gin.Context) {
		c.Header("Content-Type", "application/yaml; charset=utf-8")
		c.Header("Cache-Control", "no-cache")
		data, err := files.ReadFile("openapi.yaml")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "openapi spec okunamadı"})
			return
		}
		c.Data(http.StatusOK, "application/yaml; charset=utf-8", data)
	})

	r.GET("/api/docs", func(c *gin.Context) {
		c.Header("Content-Type", "text/html; charset=utf-8")
		c.Header("Cache-Control", "no-cache")
		data, err := files.ReadFile("docs.html")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "docs sayfası okunamadı"})
			return
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", data)
	})

	// Kısa alias
	r.GET("/docs", func(c *gin.Context) {
		c.Redirect(http.StatusFound, "/api/docs")
	})
}
