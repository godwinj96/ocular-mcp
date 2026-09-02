// Three-tier lifecycle state machine. See
// docs/rules/13-local-worker-and-distribution.md §3.
//
// Idle:   no activity for > idleShutdownMin. Browser fully terminated,
//
//	~10-15MB footprint (supervisor only).
//
// Recent: session active, no capture in flight. Browser warm, all
//
//	contexts closed, ~150-200MB.
//
// Active: a capture is in flight. Transient peak.
//
// Isolated from the socket/subprocess code on purpose so the timer logic
// is unit-testable without a real listener or a real chrome-headless-shell
// process.
package main

import (
	"sync"
	"time"
)

type LifecycleState int

const (
	StateIdle LifecycleState = iota
	StateRecent
	StateActive
)

func (s LifecycleState) String() string {
	switch s {
	case StateIdle:
		return "idle"
	case StateRecent:
		return "recent"
	case StateActive:
		return "active"
	default:
		return "unknown"
	}
}

// BrowserController is the subset of headless-shell control the lifecycle
// machine needs. Implemented for real in Phase 3 — a no-op stub is enough
// for Phase 2's timer/transition logic itself.
type BrowserController interface {
	// Warm launches the browser if not already running. Idempotent.
	Warm() error
	// Terminate fully kills the browser process. Idempotent. Never "pause"
	// or "suspend" — docs/rules/13-local-worker-and-distribution.md §3 is
	// explicit that idle shutdown terminates outright.
	Terminate() error
}

// clock is swappable so lifecycle_test.go can drive time deterministically
// instead of sleeping in real time.
type clock interface {
	Now() time.Time
}

type realClock struct{}

func (realClock) Now() time.Time { return time.Now() }

// Lifecycle owns the current tier and the idle timer. All exported methods
// are safe for concurrent use — activity can arrive from IPC handling goroutines
// while the idle sweep runs on its own ticker.
type Lifecycle struct {
	mu             sync.Mutex
	state          LifecycleState
	lastActivity   time.Time
	idleShutdown   time.Duration
	browser        BrowserController
	clk            clock
	activeCaptures int
}

func NewLifecycle(idleShutdown time.Duration, browser BrowserController) *Lifecycle {
	return newLifecycleWithClock(idleShutdown, browser, realClock{})
}

func newLifecycleWithClock(idleShutdown time.Duration, browser BrowserController, clk clock) *Lifecycle {
	return &Lifecycle{
		state:        StateIdle,
		lastActivity: clk.Now(),
		idleShutdown: idleShutdown,
		browser:      browser,
		clk:          clk,
	}
}

func (l *Lifecycle) State() LifecycleState {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.state
}

// OnSessionStart is the MCP `initialize` handshake handler — warms the
// browser eagerly per docs/rules/13-local-worker-and-distribution.md §3's
// "warm on initialize, not first capture" rule.
func (l *Lifecycle) OnSessionStart() error {
	l.mu.Lock()
	l.lastActivity = l.clk.Now()
	wasIdle := l.state == StateIdle
	l.state = StateRecent
	l.mu.Unlock()

	if wasIdle {
		return l.browser.Warm()
	}
	return nil
}

// OnCaptureStart/OnCaptureEnd bracket a single render — the Active tier is
// only true while a capture is actually in flight.
func (l *Lifecycle) OnCaptureStart() error {
	l.mu.Lock()
	l.lastActivity = l.clk.Now()
	wasIdle := l.state == StateIdle
	l.state = StateActive
	l.activeCaptures++
	l.mu.Unlock()

	if wasIdle {
		return l.browser.Warm()
	}
	return nil
}

func (l *Lifecycle) OnCaptureEnd() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.lastActivity = l.clk.Now()
	if l.activeCaptures > 0 {
		l.activeCaptures--
	}
	if l.activeCaptures == 0 && l.state == StateActive {
		l.state = StateRecent
	}
}

// CheckIdle is called on a periodic sweep (see main.go). Terminates the
// browser and drops to Idle if nothing has happened for idleShutdown and no
// capture is currently in flight. Never fires while activeCaptures > 0 —
// a long-running capture must not be killed out from under itself.
func (l *Lifecycle) CheckIdle() error {
	l.mu.Lock()
	if l.state == StateIdle || l.activeCaptures > 0 {
		l.mu.Unlock()
		return nil
	}
	elapsed := l.clk.Now().Sub(l.lastActivity)
	if elapsed < l.idleShutdown {
		l.mu.Unlock()
		return nil
	}
	l.state = StateIdle
	l.mu.Unlock()

	return l.browser.Terminate()
}
