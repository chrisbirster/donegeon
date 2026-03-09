package httpapi

import (
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"

	"donegeon/internal/testspec"
)

func TestTaskManagerParitySpecsCoverDispatchActions(t *testing.T) {
	specRoot := filepath.Join("..", "..", "docs", "specs", "taskmanager")
	tests, files, err := testspec.LoadTests[taskManagerParityCase](specRoot)
	if err != nil {
		t.Fatalf("load parity specs: %v", err)
	}
	if len(files) == 0 {
		t.Fatal("no parity spec files found")
	}

	specActions := make(map[string]struct{})
	for _, tc := range tests {
		action := strings.TrimSpace(tc.When.Action)
		if action == "" {
			continue
		}
		specActions[action] = struct{}{}
	}

	dispatchPath := filepath.Join("..", "taskmanagercompat", "service.go")
	raw, err := os.ReadFile(dispatchPath)
	if err != nil {
		t.Fatalf("read dispatch file: %v", err)
	}

	dispatchActions := make(map[string]struct{})
	casePattern := regexp.MustCompile(`(?m)^\s*case\s+(.+?):`)
	actionPattern := regexp.MustCompile(`"([^"]+)"`)
	for _, match := range casePattern.FindAllSubmatch(raw, -1) {
		for _, action := range actionPattern.FindAllSubmatch(match[1], -1) {
			dispatchActions[string(action[1])] = struct{}{}
		}
	}

	missingFromSpec := setDifference(dispatchActions, specActions)
	if len(missingFromSpec) > 0 {
		t.Fatalf("dispatch actions missing taskmanager parity specs: %v", missingFromSpec)
	}

	extraInSpec := setDifference(specActions, dispatchActions)
	extraInSpec = slices.DeleteFunc(extraInSpec, func(action string) bool {
		return action == "parse_quick_add_text"
	})
	if len(extraInSpec) > 0 {
		t.Fatalf("taskmanager parity specs reference actions not present in dispatch: %v", extraInSpec)
	}
}

func setDifference(left, right map[string]struct{}) []string {
	diff := make([]string, 0)
	for key := range left {
		if _, ok := right[key]; ok {
			continue
		}
		diff = append(diff, key)
	}
	slices.Sort(diff)
	return diff
}
