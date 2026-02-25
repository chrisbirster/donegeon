package task

import (
	"context"
	"time"

	apperrors "donegeon/internal/errors"
	"donegeon/internal/quickadd"
	"donegeon/internal/rrule"
)

type Service struct {
	repo   *Repository
	parser *quickadd.Parser
	nowFn  func() time.Time
}

func NewService(repo *Repository, parser *quickadd.Parser) *Service {
	return &Service{
		repo:   repo,
		parser: parser,
		nowFn:  time.Now,
	}
}

func (s *Service) List(ctx context.Context, params ListParams) (ListResult, error) {
	return s.repo.List(ctx, params)
}

func (s *Service) Get(ctx context.Context, id string) (Task, error) {
	return s.repo.Get(ctx, id)
}

func (s *Service) ParseQuickAdd(ctx context.Context, text string) quickadd.Parsed {
	parsed := s.parser.Parse(text)
	if parsed.RecurrenceRule != nil && parsed.DueText == nil {
		if nextDue, ok := nextOccurrenceDueText(*parsed.RecurrenceRule, timezoneFromContext(ctx), s.nowFn(), true); ok {
			parsed.DueText = strPtr(nextDue)
		}
	}
	return parsed
}

func (s *Service) Create(ctx context.Context, in CreateInput) (Task, error) {
	if in.Content == "" {
		return Task{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "content is required"), "content")
	}
	if in.Recurrence != nil {
		if _, err := rrule.Parse(*in.Recurrence); err != nil {
			return Task{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "invalid recurrence rule: "+err.Error()), "recurrenceRule")
		}
		if in.DueText == nil {
			if nextDue, ok := nextOccurrenceDueText(*in.Recurrence, timezoneFromContext(ctx), s.nowFn(), true); ok {
				in.DueText = strPtr(nextDue)
			}
		}
	}
	return s.repo.Create(ctx, in)
}

func (s *Service) CreateFromQuickAdd(ctx context.Context, text string) (Task, quickadd.Parsed, error) {
	parsed := s.ParseQuickAdd(ctx, text)
	created, err := s.Create(ctx, CreateInput{
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

	current, err := s.repo.Get(ctx, id)
	if err != nil {
		return Task{}, err
	}

	effectiveRecurrence := current.Recurrence
	if in.Recurrence != nil {
		effectiveRecurrence = in.Recurrence
	}
	if effectiveRecurrence != nil && in.DueText == nil && current.DueText == nil {
		if nextDue, ok := nextOccurrenceDueText(*effectiveRecurrence, timezoneFromContext(ctx), s.nowFn(), true); ok {
			in.DueText = strPtr(nextDue)
		}
	}

	return s.repo.Update(ctx, id, in)
}

func (s *Service) Close(ctx context.Context, id string) error {
	current, err := s.repo.Get(ctx, id)
	if err != nil {
		return err
	}
	if current.Checked {
		return nil
	}

	if err := s.repo.Close(ctx, id); err != nil {
		return err
	}

	if current.Recurrence == nil {
		return nil
	}

	nextDue := current.DueText
	loc := locationFromTimezone(timezoneFromContext(ctx))
	anchor := s.nowFn().In(loc)
	if current.DueText != nil {
		if parsedAnchor, ok := parseDueAnchor(*current.DueText, loc); ok {
			anchor = parsedAnchor
		}
	}
	if nextDueText, ok := nextOccurrenceDueText(*current.Recurrence, timezoneFromContext(ctx), anchor, false); ok {
		nextDue = strPtr(nextDueText)
	}

	_, err = s.Create(ctx, CreateInput{
		Content:     current.Content,
		Description: current.Description,
		ProjectID:   current.ProjectID,
		SectionID:   current.SectionID,
		Recurrence:  current.Recurrence,
		Priority:    current.Priority,
		DueText:     nextDue,
		DueDeadline: current.DueDeadline,
	})
	return err
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

func strPtr(value string) *string {
	v := value
	return &v
}
