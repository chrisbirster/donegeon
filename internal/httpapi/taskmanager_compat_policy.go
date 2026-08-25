package httpapi

const (
	retiredCompatibilityCollaborationReason = "legacy collaboration compatibility action is retired; use the authoritative team, board-member, project, and task APIs"
	retiredCompatibilityCommentReason       = "legacy comment compatibility action is retired until comments have a tenant-scoped product model"
)

var retiredTaskManagerActions = map[string]string{
	"moveProjectToWorkspace":       retiredCompatibilityCollaborationReason,
	"moveProjectToPersonal":        retiredCompatibilityCollaborationReason,
	"getWorkspaceActiveProjects":   retiredCompatibilityCollaborationReason,
	"getWorkspaceArchivedProjects": retiredCompatibilityCollaborationReason,
	"getProjectCollaborators":      retiredCompatibilityCollaborationReason,
	"getSharedLabels":              retiredCompatibilityCollaborationReason,
	"renameSharedLabel":            retiredCompatibilityCollaborationReason,
	"removeSharedLabel":            retiredCompatibilityCollaborationReason,
	"getWorkspaces":                retiredCompatibilityCollaborationReason,
	"getWorkspaceUsers":            retiredCompatibilityCollaborationReason,
	"getWorkspaceInvitations":      retiredCompatibilityCollaborationReason,
	"getAllWorkspaceInvitations":   retiredCompatibilityCollaborationReason,
	"joinWorkspace":                retiredCompatibilityCollaborationReason,
	"acceptWorkspaceInvitation":    retiredCompatibilityCollaborationReason,
	"rejectWorkspaceInvitation":    retiredCompatibilityCollaborationReason,
	"deleteWorkspaceInvitation":    retiredCompatibilityCollaborationReason,
	"getWorkspacePlanDetails":      retiredCompatibilityCollaborationReason,
	"addComment":                   retiredCompatibilityCommentReason,
	"getComment":                   retiredCompatibilityCommentReason,
	"getComments":                  retiredCompatibilityCommentReason,
	"updateComment":                retiredCompatibilityCommentReason,
	"deleteComment":                retiredCompatibilityCommentReason,
}

func retiredTaskManagerAction(action string) (string, bool) {
	reason, retired := retiredTaskManagerActions[action]
	return reason, retired
}
