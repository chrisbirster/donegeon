package testspec

import (
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

type envelope[T any] struct {
	Tests []T `yaml:"tests"`
}

// LoadTests reads YAML files from a file or directory tree and concatenates the
// top-level tests arrays in lexical file order.
func LoadTests[T any](root string) ([]T, []string, error) {
	files, err := YAMLFiles(root)
	if err != nil {
		return nil, nil, err
	}

	all := make([]T, 0)
	for _, path := range files {
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil, nil, err
		}

		var doc envelope[T]
		if err := yaml.Unmarshal(raw, &doc); err != nil {
			return nil, nil, err
		}
		all = append(all, doc.Tests...)
	}

	return all, files, nil
}

func YAMLFiles(root string) ([]string, error) {
	info, err := os.Stat(root)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return []string{root}, nil
	}

	files := make([]string, 0)
	err = filepath.WalkDir(root, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			return nil
		}
		switch strings.ToLower(filepath.Ext(path)) {
		case ".yaml", ".yml":
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	sort.Strings(files)
	return files, nil
}
