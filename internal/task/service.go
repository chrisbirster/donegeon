package task

import (
	"context"
	"fmt"
	"strings"
	"time"

	apperrors "donegeon/internal/errors"
	"donegeon/internal/quickadd"
	"donegeon/internal/rrule"
	"donegeon/internal/sessionctx"
	"donegeon/internal/tenant"
)

type Service struct {
	repo           *Repository
	parser         *quickadd.Parser
	nowFn          func() time.Time
	ensureProject  func(ctx context.Context, slug string) error
	resolveProject func(ctx context.Context, ref string) (*string, error)
}

func NewService(repo *Repository, parser *quickadd.Parser) *Service {
	return &Service{
		repo:   repo,
		parser: parser,
		nowFn:  time.Now,
	}
}

// SetEnsureProject sets a callback that the service will invoke to ensure a
// project exists (by slug) before inserting a task that references it. The
// callback should be idempotent (e.g. an upsert).
func (s *Service) SetEnsureProject(fn func(ctx context.Context, slug string) error) {
	s.ensureProject = fn
}

// SetResolveProject sets a callback used during quick-add to resolve a
// user-entered project reference (for example a slug alias) to an existing
// project id before task creation.
func (s *Service) SetResolveProject(fn func(ctx context.Context, ref string) (*string, error)) {
	s.resolveProject = fn
}

func (s *Service) List(ctx context.Context, params ListParams) (ListResult, error) {
	if params.ProjectID != nil {
		params.ProjectID = canonicalizeProjectID(ctx, params.ProjectID)
	}
	result, err := s.repo.List(ctx, params)
	if err != nil {
		return ListResult{}, err
	}
	for i := range result.Items {
		s.normalizeTaskTemporalFields(ctx, &result.Items[i])
		result.Items[i].ProjectID = exposeProjectID(result.Items[i].ProjectID)
	}
	return result, nil
}

func (s *Service) Get(ctx context.Context, id string) (Task, error) {
	item, err := s.repo.Get(ctx, id)
	if err != nil {
		return Task{}, err
	}
	s.normalizeTaskTemporalFields(ctx, &item)
	item.ProjectID = exposeProjectID(item.ProjectID)
	return item, nil
}

func (s *Service) ParseQuickAdd(ctx context.Context, text string) quickadd.Parsed {
	parsed := s.parser.Parse(text)
	parsed.DueText = normalizeDueText(parsed.DueText, timezoneFromContext(ctx), s.nowFn())
	parsed.Deadline = normalizeDeadline(parsed.Deadline, timezoneFromContext(ctx), s.nowFn())
	if parsed.RecurrenceRule != nil && parsed.DueText == nil {
		if nextDue, ok := nextOccurrenceDueText(*parsed.RecurrenceRule, timezoneFromContext(ctx), s.nowFn(), true); ok {
			parsed.DueText = strPtr(nextDue)
			parsed.DueText = normalizeDueText(parsed.DueText, timezoneFromContext(ctx), s.nowFn())
		}
	}
	return parsed
}

func (s *Service) Create(ctx context.Context, in CreateInput) (Task, error) {
	if in.Content == "" {
		return Task{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "content is required"), "content")
	}
	// Ensure referenced project exists before canonicalization + insert.
	if in.ProjectID != nil && strings.TrimSpace(*in.ProjectID) != "" && s.ensureProject != nil {
		if err := s.ensureProject(ctx, strings.TrimSpace(*in.ProjectID)); err != nil {
			return Task{}, fmt.Errorf("ensure project %q: %w", *in.ProjectID, err)
		}
	}
	in.ProjectID = canonicalizeProjectID(ctx, in.ProjectID)
	in.DueText = normalizeDueText(in.DueText, timezoneFromContext(ctx), s.nowFn())
	in.DueDeadline = normalizeDeadline(in.DueDeadline, timezoneFromContext(ctx), s.nowFn())
	if in.Recurrence != nil {
		if _, err := rrule.Parse(*in.Recurrence); err != nil {
			return Task{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "invalid recurrence rule: "+err.Error()), "recurrenceRule")
		}
		if in.DueText == nil {
			if nextDue, ok := nextOccurrenceDueText(*in.Recurrence, timezoneFromContext(ctx), s.nowFn(), true); ok {
				in.DueText = strPtr(nextDue)
				in.DueText = normalizeDueText(in.DueText, timezoneFromContext(ctx), s.nowFn())
			}
		}
	}
	created, err := s.repo.Create(ctx, in)
	if err != nil {
		return Task{}, err
	}
	s.normalizeTaskTemporalFields(ctx, &created)
	created.ProjectID = exposeProjectID(created.ProjectID)
	return created, nil
}

func (s *Service) CreateFromQuickAdd(ctx context.Context, text string) (Task, quickadd.Parsed, error) {
	parsed := s.ParseQuickAdd(ctx, text)
	if parsed.Project != nil && s.resolveProject != nil {
		resolved, err := s.resolveProject(ctx, strings.TrimSpace(*parsed.Project))
		if err != nil {
			return Task{}, quickadd.Parsed{}, err
		}
		if resolved != nil && strings.TrimSpace(*resolved) != "" {
			parsed.Project = strPtr(strings.TrimSpace(*resolved))
		}
	}
	scheduleInput := strings.TrimSpace(text)

	var scheduleInputPtr *string
	if scheduleInput != "" {
		scheduleInputPtr = strPtr(scheduleInput)
	}

	created, err := s.Create(ctx, CreateInput{
		Content:       parsed.Content,
		Description:   parsed.Description,
		ProjectID:     parsed.Project,
		Recurrence:    parsed.RecurrenceRule,
		Priority:      derefPriority(parsed.Priority, 4),
		DueText:       parsed.DueText,
		DueDeadline:   parsed.Deadline,
		ScheduleInput: scheduleInputPtr,
		Labels:        parsed.Labels,
	})
	if err != nil {
		return Task{}, quickadd.Parsed{}, err
	}
	return created, parsed, nil
}

func (s *Service) Update(ctx context.Context, id string, in UpdateInput) (Task, error) {
	if in.ProjectID != nil {
		in.ProjectID = canonicalizeProjectID(ctx, in.ProjectID)
	}
	if in.ClearRecurrence {
		in.Recurrence = nil
	}
	if in.ClearScheduleInput {
		in.ScheduleInput = nil
	}
	in.DueText = normalizeDueText(in.DueText, timezoneFromContext(ctx), s.nowFn())
	in.DueDeadline = normalizeDeadline(in.DueDeadline, timezoneFromContext(ctx), s.nowFn())
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
	if in.ClearRecurrence {
		effectiveRecurrence = nil
	} else if in.Recurrence != nil {
		effectiveRecurrence = in.Recurrence
	}
	if effectiveRecurrence != nil && in.DueText == nil && !in.ClearDueText && current.DueText == nil {
		if nextDue, ok := nextOccurrenceDueText(*effectiveRecurrence, timezoneFromContext(ctx), s.nowFn(), true); ok {
			in.DueText = strPtr(nextDue)
			in.DueText = normalizeDueText(in.DueText, timezoneFromContext(ctx), s.nowFn())
		}
	}

	updated, err := s.repo.Update(ctx, id, in)
	if err != nil {
		return Task{}, err
	}
	s.normalizeTaskTemporalFields(ctx, &updated)
	updated.ProjectID = exposeProjectID(updated.ProjectID)
	return updated, nil
}

func (s *Service) Close(ctx context.Context, id string) error {
	current, err := s.Get(ctx, id)
	if err != nil {
		return err
	}
	if current.Checked {
		return nil
	}
	if current.Recurrence == nil {
		return s.repo.Close(ctx, id)
	}

	nextRecurrence := recurrenceForNextOccurrence(*current.Recurrence)
	if nextRecurrence == nil {
		return s.repo.Close(ctx, id)
	}

	loc := locationFromTimezone(timezoneFromContext(ctx))
	anchor := s.nowFn().In(loc)
	if current.DueText != nil {
		if parsedAnchor, ok := parseDueAnchor(*current.DueText, loc); ok {
			anchor = parsedAnchor
		}
	}
	nextDueText, ok := nextOccurrenceDueText(*current.Recurrence, timezoneFromContext(ctx), anchor, false)
	if !ok {
		return s.repo.Close(ctx, id)
	}
	nextDue := normalizeDueText(strPtr(nextDueText), timezoneFromContext(ctx), anchor)
	nextDeadline := shiftRecurringDeadline(current.DueText, current.DueDeadline, nextDue, timezoneFromContext(ctx))

	return s.repo.CloseRecurringAndCreateNext(ctx, id, CreateInput{
		Content:       current.Content,
		Description:   current.Description,
		ProjectID:     canonicalizeProjectID(ctx, current.ProjectID),
		SectionID:     current.SectionID,
		Recurrence:    nextRecurrence,
		Priority:      current.Priority,
		DueText:       nextDue,
		DueDeadline:   nextDeadline,
		ScheduleInput: current.ScheduleInput,
		Labels:        current.Labels,
	})
}

func recurrenceForNextOccurrence(raw string) *string {
	parsed, err := rrule.Parse(raw)
	if err != nil {
		return strPtr(raw)
	}
	if parsed.Count == nil {
		return strPtr(raw)
	}
	if *parsed.Count <= 1 {
		return nil
	}
	remaining := *parsed.Count - 1
	parsed.Count = &remaining
	return strPtr(parsed.Canonical())
}

func shiftRecurringDeadline(currentDue, currentDeadline, nextDue *string, timezone string) *string {
	if currentDeadline == nil {
		return nil
	}
	if currentDue == nil || nextDue == nil {
		return currentDeadline
	}
	loc := locationFromTimezone(timezone)
	currentDueTime, dueOK := parseDueAnchor(*currentDue, loc)
	currentDeadlineTime, deadlineOK := parseDueAnchor(*currentDeadline, loc)
	nextDueTime, nextDueOK := parseDueAnchor(*nextDue, loc)
	if !dueOK || !deadlineOK || !nextDueOK {
		return currentDeadline
	}
	shifted := nextDueTime.Add(currentDeadlineTime.Sub(currentDueTime)).In(loc)
	return strPtr(shifted.Format(time.RFC3339))
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

func canonicalizeProjectID(ctx context.Context, value *string) *string {
	if value == nil {
		return nil
	}
	projectID := strings.TrimSpace(*value)
	if projectID == "" {
		return nil
	}
	workspaceID := sessionctx.WorkspaceID(ctx)
	if workspaceID == sessionctx.DefaultWorkspaceID && !strings.Contains(projectID, "::") {
		return strPtr(projectID)
	}
	canonical := tenant.CanonicalProjectID(workspaceID, projectID)
	return strPtr(canonical)
}

func exposeProjectID(value *string) *string {
	if value == nil {
		return nil
	}
	slug := tenant.ProjectSlug(strings.TrimSpace(*value))
	if slug == "" {
		return nil
	}
	return strPtr(slug)
}

func (s *Service) normalizeTaskTemporalFields(ctx context.Context, item *Task) {
	if item == nil {
		return
	}
	item.DueText = normalizeDueText(item.DueText, timezoneFromContext(ctx), s.deadlineAnchor(*item))
	item.DueDeadline = normalizeDeadline(item.DueDeadline, timezoneFromContext(ctx), s.deadlineAnchor(*item))
}

func (s *Service) deadlineAnchor(item Task) time.Time {
	if parsed, err := time.Parse(time.RFC3339, item.CreatedAt); err == nil {
		return parsed
	}
	if parsed, err := time.Parse(time.RFC3339, item.UpdatedAt); err == nil {
		return parsed
	}
	return s.nowFn()
}
