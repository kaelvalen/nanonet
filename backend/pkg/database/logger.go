package database

import (
	"context"
	"log/slog"
	"time"

	"gorm.io/gorm/logger"
)

// GormLogger adapts slog for GORM logging
type GormLogger struct {
	logger *slog.Logger
	level  logger.LogLevel
}

func NewGormLogger(l *slog.Logger, level logger.LogLevel) *GormLogger {
	return &GormLogger{
		logger: l,
		level:  level,
	}
}

func (l *GormLogger) LogMode(level logger.LogLevel) logger.Interface {
	return &GormLogger{logger: l.logger, level: level}
}

func (l *GormLogger) Info(ctx context.Context, msg string, data ...interface{}) {
	if l.level >= logger.Info {
		l.logger.InfoContext(ctx, msg, slog.Any("data", data))
	}
}

func (l *GormLogger) Warn(ctx context.Context, msg string, data ...interface{}) {
	if l.level >= logger.Warn {
		l.logger.WarnContext(ctx, msg, slog.Any("data", data))
	}
}

func (l *GormLogger) Error(ctx context.Context, msg string, data ...interface{}) {
	if l.level >= logger.Error {
		l.logger.ErrorContext(ctx, msg, slog.Any("data", data))
	}
}

func (l *GormLogger) Trace(ctx context.Context, begin time.Time, fc func() (string, int64), err error) {
	if l.level <= logger.Silent {
		return
	}

	elapsed := time.Since(begin)
	sql, rows := fc()

	switch {
	case err != nil && l.level >= logger.Error:
		l.logger.ErrorContext(ctx, "query error",
			slog.Duration("duration", elapsed),
			slog.String("sql", sql),
			slog.Int64("rows", rows),
			slog.String("error", err.Error()),
		)
	case elapsed > 200*time.Millisecond && l.level >= logger.Warn:
		l.logger.WarnContext(ctx, "slow query",
			slog.Duration("duration", elapsed),
			slog.String("sql", sql),
			slog.Int64("rows", rows),
		)
	case l.level == logger.Info:
		l.logger.DebugContext(ctx, "query",
			slog.Duration("duration", elapsed),
			slog.String("sql", sql),
			slog.Int64("rows", rows),
		)
	}
}
