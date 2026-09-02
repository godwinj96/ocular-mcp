package main

import (
	"errors"
	"testing"
	"time"
)

// fakeClock lets tests advance time deterministically instead of sleeping.
type fakeClock struct {
	now time.Time
}

func (c *fakeClock) Now() time.Time { return c.now }
func (c *fakeClock) advance(d time.Duration) {
	c.now = c.now.Add(d)
}

// fakeBrowser records Warm/Terminate calls and can be told to fail.
type fakeBrowser struct {
	warmCalls      int
	terminateCalls int
	warmErr        error
	terminateErr   error
}

func (b *fakeBrowser) Warm() error {
	b.warmCalls++
	return b.warmErr
}

func (b *fakeBrowser) Terminate() error {
	b.terminateCalls++
	return b.terminateErr
}

func newTestLifecycle(idleShutdown time.Duration) (*Lifecycle, *fakeClock, *fakeBrowser) {
	clk := &fakeClock{now: time.Unix(0, 0)}
	browser := &fakeBrowser{}
	l := newLifecycleWithClock(idleShutdown, browser, clk)
	return l, clk, browser
}

func TestStartsIdle(t *testing.T) {
	l, _, browser := newTestLifecycle(30 * time.Minute)
	if l.State() != StateIdle {
		t.Fatalf("expected initial state Idle, got %s", l.State())
	}
	if browser.warmCalls != 0 {
		t.Fatalf("expected no warm calls before any session, got %d", browser.warmCalls)
	}
}

func TestSessionStartWarmsFromIdleAndMovesToRecent(t *testing.T) {
	l, _, browser := newTestLifecycle(30 * time.Minute)

	if err := l.OnSessionStart(); err != nil {
		t.Fatalf("OnSessionStart: %v", err)
	}
	if l.State() != StateRecent {
		t.Fatalf("expected Recent after session start, got %s", l.State())
	}
	if browser.warmCalls != 1 {
		t.Fatalf("expected exactly 1 warm call, got %d", browser.warmCalls)
	}
}

func TestSecondSessionStartDoesNotRewarmWhenAlreadyRecent(t *testing.T) {
	l, _, browser := newTestLifecycle(30 * time.Minute)

	_ = l.OnSessionStart()
	_ = l.OnSessionStart()

	if browser.warmCalls != 1 {
		t.Fatalf("expected warm to be called once (idempotent), got %d", browser.warmCalls)
	}
}

func TestCaptureLifecycleMovesActiveThenBackToRecent(t *testing.T) {
	l, _, _ := newTestLifecycle(30 * time.Minute)
	_ = l.OnSessionStart()

	if err := l.OnCaptureStart(); err != nil {
		t.Fatalf("OnCaptureStart: %v", err)
	}
	if l.State() != StateActive {
		t.Fatalf("expected Active during capture, got %s", l.State())
	}

	l.OnCaptureEnd()
	if l.State() != StateRecent {
		t.Fatalf("expected Recent after capture ends, got %s", l.State())
	}
}

func TestOverlappingCapturesOnlyDropToRecentWhenLastOneEnds(t *testing.T) {
	l, _, _ := newTestLifecycle(30 * time.Minute)
	_ = l.OnSessionStart()

	_ = l.OnCaptureStart()
	_ = l.OnCaptureStart() // second concurrent capture

	l.OnCaptureEnd() // first finishes
	if l.State() != StateActive {
		t.Fatalf("expected still Active with one capture still in flight, got %s", l.State())
	}

	l.OnCaptureEnd() // second finishes
	if l.State() != StateRecent {
		t.Fatalf("expected Recent once all captures finish, got %s", l.State())
	}
}

func TestCheckIdleDoesNothingBeforeThreshold(t *testing.T) {
	l, clk, browser := newTestLifecycle(30 * time.Minute)
	_ = l.OnSessionStart()
	browser.warmCalls = 0 // isolate to CheckIdle's own behavior

	clk.advance(29 * time.Minute)
	if err := l.CheckIdle(); err != nil {
		t.Fatalf("CheckIdle: %v", err)
	}
	if l.State() != StateRecent {
		t.Fatalf("expected still Recent before threshold, got %s", l.State())
	}
	if browser.terminateCalls != 0 {
		t.Fatalf("expected no terminate before threshold, got %d", browser.terminateCalls)
	}
}

func TestCheckIdleTerminatesAndDropsToIdleAfterThreshold(t *testing.T) {
	l, clk, browser := newTestLifecycle(30 * time.Minute)
	_ = l.OnSessionStart()

	clk.advance(31 * time.Minute)
	if err := l.CheckIdle(); err != nil {
		t.Fatalf("CheckIdle: %v", err)
	}
	if l.State() != StateIdle {
		t.Fatalf("expected Idle after threshold elapses, got %s", l.State())
	}
	if browser.terminateCalls != 1 {
		t.Fatalf("expected exactly 1 terminate call, got %d", browser.terminateCalls)
	}
}

func TestCheckIdleNeverFiresWhileACaptureIsInFlight(t *testing.T) {
	// The single most important guarantee in this file: a long-running
	// capture must never be killed out from under itself by the idle sweep,
	// even if it runs past the idle threshold.
	l, clk, browser := newTestLifecycle(30 * time.Minute)
	_ = l.OnSessionStart()
	_ = l.OnCaptureStart()

	clk.advance(31 * time.Minute)
	if err := l.CheckIdle(); err != nil {
		t.Fatalf("CheckIdle: %v", err)
	}
	if l.State() != StateActive {
		t.Fatalf("expected still Active — a capture was in flight, got %s", l.State())
	}
	if browser.terminateCalls != 0 {
		t.Fatalf("expected no terminate while a capture is in flight, got %d", browser.terminateCalls)
	}
}

func TestCheckIdleIsANoOpWhenAlreadyIdle(t *testing.T) {
	l, clk, browser := newTestLifecycle(30 * time.Minute)
	// Never call OnSessionStart — starts and stays Idle.

	clk.advance(2 * time.Hour)
	if err := l.CheckIdle(); err != nil {
		t.Fatalf("CheckIdle: %v", err)
	}
	if browser.terminateCalls != 0 {
		t.Fatalf("expected no terminate call when already idle, got %d", browser.terminateCalls)
	}
}

func TestActivityAfterIdleWarmsAgain(t *testing.T) {
	// Idle -> Recent -> (timeout) -> Idle -> Recent again should re-warm,
	// since the browser was actually terminated in between.
	l, clk, browser := newTestLifecycle(30 * time.Minute)
	_ = l.OnSessionStart()
	clk.advance(31 * time.Minute)
	_ = l.CheckIdle()

	if err := l.OnSessionStart(); err != nil {
		t.Fatalf("OnSessionStart after idle: %v", err)
	}
	if browser.warmCalls != 2 {
		t.Fatalf("expected 2 warm calls (initial + re-warm after idle), got %d", browser.warmCalls)
	}
}

func TestOnSessionStartPropagatesWarmError(t *testing.T) {
	l, _, browser := newTestLifecycle(30 * time.Minute)
	browser.warmErr = errors.New("chrome-headless-shell failed to launch")

	if err := l.OnSessionStart(); err == nil {
		t.Fatal("expected OnSessionStart to propagate the browser's Warm error")
	}
}

func TestCheckIdlePropagatesTerminateError(t *testing.T) {
	l, clk, browser := newTestLifecycle(30 * time.Minute)
	_ = l.OnSessionStart()
	browser.terminateErr = errors.New("process already exited")

	clk.advance(31 * time.Minute)
	if err := l.CheckIdle(); err == nil {
		t.Fatal("expected CheckIdle to propagate the browser's Terminate error")
	}
	// State still drops to Idle even though termination reported an error —
	// the process is presumed gone either way (e.g. "already exited" is not
	// a reason to keep believing it's warm).
	if l.State() != StateIdle {
		t.Fatalf("expected Idle even when Terminate errored, got %s", l.State())
	}
}
