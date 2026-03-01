package project

import (
	"context"
	"strings"

	apperrors "donegeon/internal/errors"
	"donegeon/internal/sessionctx"
	"donegeon/internal/tenant"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, params ListParams) ([]Project, error) {
	rows, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, err
	}
	for i := range rows {
		slug := tenant.ProjectSlug(rows[i].ID)
		rows[i].ID = slug
		if tenant.IsInboxProject(slug) {
			rows[i].IsInboxProject = true
		}
	}
	return rows, nil
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

	workspaceID := sessionctx.WorkspaceID(ctx)
	canonicalID := id
	if workspaceID != sessionctx.DefaultWorkspaceID || strings.Contains(id, "::") {
		canonicalID = tenant.CanonicalProjectID(workspaceID, id)
	}
	updated, err := s.repo.Upsert(ctx, canonicalID, in)
	if err != nil {
		return Project{}, err
	}
	updated.ID = tenant.ProjectSlug(updated.ID)
	if tenant.IsInboxProject(updated.ID) {
		updated.IsInboxProject = true
	}
	return updated, nil
}

func (s *Service) Delete(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "project id is required"), "projectId")
	}

	workspaceID := sessionctx.WorkspaceID(ctx)
	canonicalID := id
	if workspaceID != sessionctx.DefaultWorkspaceID || strings.Contains(id, "::") {
		canonicalID = tenant.CanonicalProjectID(workspaceID, id)
	}

	slug := tenant.ProjectSlug(canonicalID)
	if tenant.IsInboxProject(slug) {
		return apperrors.WithField(
			apperrors.New(apperrors.CodeValidationError, "inbox project cannot be deleted"),
			"projectId",
		)
	}
	if strings.EqualFold(slug, "board") {
		return apperrors.WithField(
			apperrors.New(apperrors.CodeValidationError, "default board cannot be deleted"),
			"projectId",
		)
	}

	return s.repo.Delete(ctx, canonicalID)
}
