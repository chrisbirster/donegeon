package quickadd

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

type parserParityCase struct {
	Name     string `json:"name"`
	Input    string `json:"input"`
	Expected Parsed `json:"expected"`
}

func TestParserSharedParityCorpus(t *testing.T) {
	t.Parallel()

	path := filepath.Join("..", "..", "docs", "specs", "quickadd", "parser-parity.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read parser parity corpus: %v", err)
	}

	var cases []parserParityCase
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatalf("decode parser parity corpus: %v", err)
	}
	if len(cases) == 0 {
		t.Fatal("parser parity corpus must not be empty")
	}

	parser := NewParser()
	for _, tc := range cases {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			got := parser.Parse(tc.Input)
			if !reflect.DeepEqual(got, tc.Expected) {
				gotJSON, _ := json.Marshal(got)
				wantJSON, _ := json.Marshal(tc.Expected)
				t.Fatalf("parser mismatch\ninput: %q\n got: %s\nwant: %s", tc.Input, gotJSON, wantJSON)
			}
		})
	}
}
