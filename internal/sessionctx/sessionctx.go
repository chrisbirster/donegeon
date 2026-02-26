package sessionctx

import "context"

type ctxKey string

const (
	ctxKeyUserID      ctxKey = "session_user_id"
	ctxKeyWorkspaceID ctxKey = "session_workspace_id"
	ctxKeyUserEmail   ctxKey = "session_user_email"
)

const (
	DefaultUserID      = "U1"
	DefaultWorkspaceID = "W1"
)

type Principal struct {
	UserID      string
	WorkspaceID string
	Email       string
}

func WithPrincipal(ctx context.Context, principal Principal) context.Context {
	withUser := context.WithValue(ctx, ctxKeyUserID, principal.UserID)
	withWorkspace := context.WithValue(withUser, ctxKeyWorkspaceID, principal.WorkspaceID)
	return context.WithValue(withWorkspace, ctxKeyUserEmail, principal.Email)
}

func PrincipalFromContext(ctx context.Context) Principal {
	userID, _ := ctx.Value(ctxKeyUserID).(string)
	workspaceID, _ := ctx.Value(ctxKeyWorkspaceID).(string)
	email, _ := ctx.Value(ctxKeyUserEmail).(string)

	if userID == "" {
		userID = DefaultUserID
	}
	if workspaceID == "" {
		workspaceID = DefaultWorkspaceID
	}

	return Principal{
		UserID:      userID,
		WorkspaceID: workspaceID,
		Email:       email,
	}
}

func UserID(ctx context.Context) string {
	return PrincipalFromContext(ctx).UserID
}

func WorkspaceID(ctx context.Context) string {
	return PrincipalFromContext(ctx).WorkspaceID
}
