package dist

import "embed"

// Files contains the Vite build output under web/dist.
// Keep root-level PWA artifacts embedded alongside the hashed asset directory.
// The tracked PWA files are safe fallbacks for Go-only builds; Vite replaces
// them with the production artifacts before release builds.
//go:embed index.html manifest.webmanifest sw.js assets/*
var Files embed.FS
