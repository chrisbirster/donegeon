package dist

import "embed"

// Files contains the Vite build output under web/dist.
//go:embed index.html assets/*
var Files embed.FS
