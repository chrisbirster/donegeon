package project

import (
	"context"
	"strings"

	apperrors "donegeon/internal/errors"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, params ListParams) ([]Project, error) {
	return s.repo.List(ctx, params)
}

func (s *Service) Upsert(ctx context.Context, id string, in UpsertInput) (Project, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return Project{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "project id is required"), "projectId")
	}

	if in.Name != nil {
		trimmed := strings.TrimSpace(*in.Name)
		if trimmed == "" {
			return Project{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "project name is required"), "name")
		}
		in.Name = &trimmed
	}

	return s.repo.Upsert(ctx, id, in)
}
