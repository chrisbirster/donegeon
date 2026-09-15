package quickadd

import "regexp"

// Keep priority tokens case-insensitive to match the browser preview and the
// documented Quick Add contract. priorityPattern is declared with the parser's
// other token regexes in parser.go; centralizing this compatibility override
// here avoids changing the parser's extraction semantics.
func init() {
	priorityPattern = regexp.MustCompile(`(?i)^p([1-4])$`)
}
