package logs

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ServiceLog — service_logs hypertable satırı
type ServiceLog struct {
	Time      time.Time      `gorm:"column:time;primaryKey"         json:"time"`
	ID        uuid.UUID      `gorm:"column:id;primaryKey;type:uuid" json:"id"`
	ServiceID uuid.UUID      `gorm:"column:service_id;type:uuid"    json:"service_id"`
	Level     string         `gorm:"column:level"                   json:"level"`
	Source    string         `gorm:"column:source"                  json:"source"`
	Message   string         `gorm:"column:message"                 json:"message"`
	Fields    map[string]any `gorm:"column:fields;serializer:json"  json:"fields,omitempty"`
}

func (ServiceLog) TableName() string { return "service_logs" }

// Repository — service_logs CRUD
type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Insert — tek log satırı ekle
func (r *Repository) Insert(ctx context.Context, entry *ServiceLog) error {
	if entry.ID == uuid.Nil {
		entry.ID = uuid.New()
	}
	if entry.Time.IsZero() {
		entry.Time = time.Now()
	}
	return r.db.WithContext(ctx).Create(entry).Error
}

// GetByService — bir servise ait logları sayfalı getir
func (r *Repository) GetByService(ctx context.Context, serviceID uuid.UUID, opts QueryOpts) ([]ServiceLog, int64, error) {
	q := r.db.WithContext(ctx).
		Model(&ServiceLog{}).
		Where("service_id = ?", serviceID)

	if opts.Level != "" {
		q = q.Where("level = ?", opts.Level)
	}
	if opts.Source != "" {
		q = q.Where("source = ?", opts.Source)
	}
	if opts.Search != "" {
		q = q.Where("message ILIKE ?", "%"+opts.Search+"%")
	}
	if !opts.Since.IsZero() {
		q = q.Where("time >= ?", opts.Since)
	}
	if !opts.Until.IsZero() {
		q = q.Where("time <= ?", opts.Until)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []ServiceLog
	err := q.Order("time DESC").Limit(opts.limit()).Offset(opts.offset()).Find(&rows).Error
	return rows, total, err
}

// SearchAll — tüm servisler genelinde log ara
func (r *Repository) SearchAll(ctx context.Context, opts QueryOpts) ([]ServiceLog, int64, error) {
	q := r.db.WithContext(ctx).
		Model(&ServiceLog{})

	if opts.Level != "" {
		q = q.Where("level = ?", opts.Level)
	}
	if opts.Source != "" {
		q = q.Where("source = ?", opts.Source)
	}
	if opts.Search != "" {
		q = q.Where("message ILIKE ?", "%"+opts.Search+"%")
	}
	if !opts.Since.IsZero() {
		q = q.Where("time >= ?", opts.Since)
	}
	if !opts.Until.IsZero() {
		q = q.Where("time <= ?", opts.Until)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []ServiceLog
	err := q.Order("time DESC").Limit(opts.limit()).Offset(opts.offset()).Find(&rows).Error
	return rows, total, err
}

// GetStats — level bazlı log sayıları
func (r *Repository) GetStats(ctx context.Context, since time.Time, serviceID *uuid.UUID) ([]LevelStat, error) {
	var stats []LevelStat
	q := r.db.WithContext(ctx).
		Model(&ServiceLog{}).
		Select("level, COUNT(*) as count").
		Where("time >= ?", since)
	if serviceID != nil {
		q = q.Where("service_id = ?", *serviceID)
	}
	err := q.Group("level").Scan(&stats).Error
	return stats, err
}

// LevelStat — GetStats dönüş tipi
type LevelStat struct {
	Level string `json:"level"`
	Count int64  `json:"count"`
}

// QueryOpts — sorgu parametreleri
type QueryOpts struct {
	Level  string
	Source string
	Search string
	Since  time.Time
	Until  time.Time
	Page   int
	Offset int
	Limit  int
}

func (o QueryOpts) limit() int {
	if o.Limit <= 0 || o.Limit > 500 {
		return 100
	}
	return o.Limit
}

func (o QueryOpts) offset() int {
	if o.Offset > 0 {
		return o.Offset
	}
	if o.Page <= 1 {
		return 0
	}
	return (o.Page - 1) * o.limit()
}
