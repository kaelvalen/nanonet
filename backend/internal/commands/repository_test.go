package commands

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func newMockRepo(t *testing.T) (*Repository, sqlmock.Sqlmock, func()) {
	t.Helper()

	sqlDB, mock, err := sqlmock.New()
	require.NoError(t, err)

	db, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{
		DisableAutomaticPing: true,
	})
	require.NoError(t, err)

	cleanup := func() {
		mock.ExpectClose()
		require.NoError(t, sqlDB.Close())
		require.NoError(t, mock.ExpectationsWereMet())
	}

	return NewRepository(db), mock, cleanup
}

func TestHasInFlightCommandIncludesReceivedStatus(t *testing.T) {
	repo, mock, cleanup := newMockRepo(t)
	defer cleanup()

	serviceID := uuid.New()
	action := "restart"

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT count(*) FROM "command_logs" WHERE service_id = $1 AND action = $2 AND status IN ('queued', 'sent', 'received') AND queued_at > $3`)).
		WithArgs(serviceID, action, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	ok, err := repo.HasInFlightCommand(context.Background(), serviceID, action)
	require.NoError(t, err)
	require.True(t, ok)
}

func TestMarkStalledCommandsTimeoutIncludesReceivedStatus(t *testing.T) {
	repo, mock, cleanup := newMockRepo(t)
	defer cleanup()

	threshold := time.Now().Add(-5 * time.Minute)

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "command_logs" SET .* WHERE status IN \('queued', 'sent', 'received'\) AND queued_at < \$3`).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectCommit()

	err := repo.MarkStalledCommandsTimeout(context.Background(), threshold)
	require.NoError(t, err)
}

func TestCompleteFromAgent_PersistsOutputAndErrorMessage(t *testing.T) {
	repo, mock, cleanup := newMockRepo(t)
	defer cleanup()

	commandID := "cmd_123"
	out := "hello"
	errText := "boom"

	mock.ExpectExec(`UPDATE command_logs SET`).
		WithArgs("failed", out, errText, commandID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.CompleteFromAgent(context.Background(), commandID, "failed", &out, &errText)
	require.NoError(t, err)
}
