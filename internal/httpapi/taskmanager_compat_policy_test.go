package httpapi

import "testing"

func TestRetiredTaskManagerActions(t *testing.T) {
	t.Parallel()

	actions := []string{
		"moveProjectToWorkspace",
		"moveProjectToPersonal",
		"getWorkspaceActiveProjects",
		"getWorkspaceArchivedProjects",
		"getProjectCollaborators",
		"getSharedLabels",
		"renameSharedLabel",
		"removeSharedLabel",
		"getWorkspaces",
		"getWorkspaceUsers",
		"getWorkspaceInvitations",
		"getAllWorkspaceInvitations",
		"joinWorkspace",
		"acceptWorkspaceInvitation",
		"rejectWorkspaceInvitation",
		"deleteWorkspaceInvitation",
		"getWorkspacePlanDetails",
		"addComment",
		"getComment",
		"getComments",
		"updateComment",
		"deleteComment",
	}

	for _, action := range actions {
		action := action
		t.Run(action, func(t *testing.T) {
			t.Parallel()
			reason, retired := retiredTaskManagerAction(action)
			if !retired {
				t.Fatalf("expected %q to be retired", action)
			}
			if reason == "" {
				t.Fatalf("expected %q to include a retirement reason", action)
			}
		})
	}
}

func TestCoreTaskManagerCompatibilityActionsRemainAvailable(t *testing.T) {
	t.Parallel()

	actions := []string{
		"addTask",
		"quickAddTask",
		"getTask",
		"getTasks",
		"updateTask",
		"closeTask",
		"reopenTask",
		"deleteTask",
		"moveTask",
		"moveTasks",
		"addProject",
		"getProject",
		"getProjects",
		"updateProject",
		"archiveProject",
		"unarchiveProject",
		"addSection",
		"getSections",
		"addLabel",
		"getLabels",
	}

	for _, action := range actions {
		if reason, retired := retiredTaskManagerAction(action); retired {
			t.Fatalf("core compatibility action %q was unexpectedly retired: %s", action, reason)
		}
	}
}
