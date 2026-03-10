package httpapi

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	quickAddParseLimitBurst         = 24
	quickAddParseLimitRatePerSecond = 5
	quickAddParseLimiterTTL         = 10 * time.Minute
)

type tokenBucketLimiter struct {
	mu      sync.Mutex
	buckets map[string]*tokenBucket
	rate    float64
	burst   float64
	ttl     time.Duration
}

type tokenBucket struct {
	tokens     float64
	lastRefill time.Time
	lastSeen   time.Time
}

func newTokenBucketLimiter(ratePerSecond float64, burst int, ttl time.Duration) *tokenBucketLimiter {
	return &tokenBucketLimiter{
		buckets: make(map[string]*tokenBucket),
		rate:    ratePerSecond,
		burst:   float64(burst),
		ttl:     ttl,
	}
}

func (l *tokenBucketLimiter) Allow(key string, now time.Time) bool {
	if l == nil {
		return true
	}

	key = strings.TrimSpace(key)
	if key == "" {
		key = "anonymous"
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	for bucketKey, bucket := range l.buckets {
		if now.Sub(bucket.lastSeen) > l.ttl {
			delete(l.buckets, bucketKey)
		}
	}

	bucket, ok := l.buckets[key]
	if !ok {
		l.buckets[key] = &tokenBucket{
			tokens:     l.burst - 1,
			lastRefill: now,
			lastSeen:   now,
		}
		return true
	}

	elapsedSeconds := now.Sub(bucket.lastRefill).Seconds()
	if elapsedSeconds > 0 {
		bucket.tokens += elapsedSeconds * l.rate
		if bucket.tokens > l.burst {
			bucket.tokens = l.burst
		}
		bucket.lastRefill = now
	}
	bucket.lastSeen = now

	if bucket.tokens < 1 {
		return false
	}

	bucket.tokens -= 1
	return true
}

func quickAddParseLimiterKey(r *http.Request) string {
	if state := requestLogStateFromContext(r.Context()); state != nil && state.Authenticated {
		userID := strings.TrimSpace(state.Principal.UserID)
		if userID != "" {
			return "user:" + userID
		}
	}

	if ip := strings.TrimSpace(clientIPFromRequest(r)); ip != "" {
		return "ip:" + ip
	}

	return "anonymous"
}
