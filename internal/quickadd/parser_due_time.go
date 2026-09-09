package quickadd

import "regexp"

// Timed tomorrow phrases must be matched as one due expression so an explicit
// clock time is not left behind in task content and the scheduler receives the
// full local-time instruction.
func init() {
	timedTomorrow := regexp.MustCompile(`(?i)\b(?:due\s+(?:on\s+)?)?tomorrow(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\b`)
	duePatterns = append([]*regexp.Regexp{timedTomorrow}, duePatterns...)
}
