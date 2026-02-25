package task

import (
	"context"

	apperrors "donegeon/internal/errors"
	"donegeon/internal/quickadd"
	"donegeon/internal/rrule"
)

type Service struct {
	repo   *Repository
	parser *quickadd.Parser
}

func NewService(repo *Repository, parser *quickadd.Parser) *Service {
	return &Service{repo: repo, parser: parser}
}

func (s *Service) List(ctx context.Context, params ListParams) (ListResult, error) {
	return s.repo.List(ctx, params)
}

func (s *Service) Get(ctx context.Context, id string) (Task, error) {
	return s.repo.Get(ctx, id)
}

func (s *Service) Create(ctx context.Context, in CreateInput) (Task, error) {
	if in.Content == "" {
		return Task{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "content is required"), "content")
	}
	if in.Recurrence != nil {
		if _, err := rrule.Parse(*in.Recurrence); err != nil {
			return Task{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "invalid recurrence rule: "+err.Error()), "recurrenceRule")
		}
	}
	return s.repo.Create(ctx, in)
}

func (s *Service) CreateFromQuickAdd(ctx context.Context, text string) (Task, quickadd.Parsed, error) {
	parsed := s.parser.Parse(text)
	created, err := s.repo.Create(ctx, CreateInput{
		Content:     parsed.Content,
		Description: parsed.Description,
		ProjectID:   parsed.Project,
		Recurrence:  parsed.RecurrenceRule,
		Priority:    derefPriority(parsed.Priority, 4),
		DueText:     parsed.DueText,
		DueDeadline: parsed.Deadline,
	})
	if err != nil {
		return Task{}, quickadd.Parsed{}, err
	}
	return created, parsed, nil
}

func (s *Service) Update(ctx context.Context, id string, in UpdateInput) (Task, error) {
	if in.Recurrence != nil {
		if _, err := rrule.Parse(*in.Recurrence); err != nil {
			return Task{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "invalid recurrence rule: "+err.Error()), "recurrenceRule")
		}
	}
	return s.repo.Update(ctx, id, in)
}

func (s *Service) Close(ctx context.Context, id string) error {
	return s.repo.Close(ctx, id)
}

func (s *Service) Reopen(ctx context.Context, id string) error {
	return s.repo.Reopen(ctx, id)
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func derefPriority(priority *int, fallback int) int {
	if priority == nil {
		return fallback
	}
	return *priority
}
