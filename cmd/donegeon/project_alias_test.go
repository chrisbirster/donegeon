package donegeon

import (
	"testing"

	"donegeon/internal/project"
)

func TestResolveProjectIDByReference(t *testing.T) {
	t.Parallel()

	projects := []project.Project{
		{ID: "inbox", Name: "inbox"},
		{ID: "board", Name: "Board"},
		{ID: "board-super-cool-team", Name: "Super Cool Team"},
		{ID: "W_team123::board-marketing-roadmap", Name: "Marketing Roadmap"},
		{ID: "home-admin", Name: "Home Admin"},
	}

	tests := []struct {
		name string
		ref  string
		want *string
	}{
		{
			name: "matches exact id",
			ref:  "home-admin",
			want: strPtr("home-admin"),
		},
		{
			name: "matches exact display name",
			ref:  "Super Cool Team",
			want: strPtr("board-super-cool-team"),
		},
		{
			name: "matches display name slug",
			ref:  "home admin",
			want: strPtr("home-admin"),
		},
		{
			name: "matches board alias without board prefix",
			ref:  "super-cool-team",
			want: strPtr("board-super-cool-team"),
		},
		{
			name: "matches workspace board alias",
			ref:  "marketing-roadmap",
			want: strPtr("W_team123::board-marketing-roadmap"),
		},
		{
			name: "returns nil when unresolved",
			ref:  "does-not-exist",
			want: nil,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := resolveProjectIDByReference(tc.ref, projects)
			if strOrNil(got) != strOrNil(tc.want) {
				t.Fatalf("unexpected resolve result: got=%v want=%v", strOrNil(got), strOrNil(tc.want))
			}
		})
	}
}

func TestSlugifyProjectAlias(t *testing.T) {
	t.Parallel()

	tests := []struct {
		input string
		want  string
	}{
		{input: "asdf asdf", want: "asdf-asdf"},
		{input: "W_abc::board-super team", want: "board-super-team"},
		{input: "  @@@", want: ""},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.input, func(t *testing.T) {
			t.Parallel()
			got := slugifyProjectAlias(tc.input)
			if got != tc.want {
				t.Fatalf("unexpected slug: got=%q want=%q", got, tc.want)
			}
		})
	}
}

func strOrNil(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}

func strPtr(value string) *string {
	v := value
	return &v
}
