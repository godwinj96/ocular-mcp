// Real chrome-headless-shell process management — the supervisor spawns
// and kills the browser subprocess (docs/rules/13-local-worker-and-distribution.md
// §2's process diagram: "supervisor (Go) --spawns/kills--> chrome-headless-shell").
// CDP *control* (navigate/screenshot/evaluate) stays entirely in Node's
// src/browser/headless-shell.ts, per docs/rules/02-repo-structure.md §1's
// "headless-shell.ts — ONLY CDP touchpoint" — this file only ever reads one
// line from the browser's own stderr to learn its DevTools WebSocket URL,
// never speaks the CDP protocol itself. The URL is handed back to Node in
// the IPC response for "warm"/"capture_start"/"status" so Node can connect.
package main

import (
	"bufio"
	"fmt"
	"io"
	"log/slog"
	"os/exec"
	"regexp"
	"sync"
	"time"
)

// GPU/ANGLE flags per docs/rules/13-local-worker-and-distribution.md §8:
// request hardware acceleration; Chromium falls back to SwiftShader
// automatically where unavailable (correct, just slower — not a failure).
var launchArgs = []string{
	"--headless",
	"--remote-debugging-port=0",
	"--hide-scrollbars",
	"--mute-audio",
	"--disable-background-networking",
	"--enable-gpu-rasterization",
	"--enable-zero-copy",
	"--ignore-gpu-blocklist",
}

// Chromium prints this line to stderr when launched with
// --remote-debugging-port=0 — the standard, race-free way to discover the
// actual port (same technique Playwright/Puppeteer use), rather than
// pre-picking a port ourselves.
var devtoolsListeningRE = regexp.MustCompile(`DevTools listening on (ws://\S+)`)

type headlessShellBrowser struct {
	execPath    string
	userDataDir string
	logger      *slog.Logger

	mu     sync.Mutex
	cmd    *exec.Cmd
	cdpURL string
}

func newHeadlessShellBrowser(execPath, userDataDir string, logger *slog.Logger) *headlessShellBrowser {
	return &headlessShellBrowser{execPath: execPath, userDataDir: userDataDir, logger: logger}
}

// CdpURL returns the current DevTools WebSocket URL, or "" if the browser
// isn't running. Safe to call from the IPC goroutine while Warm/Terminate
// run on the same goroutine (IPC requests are handled serially per
// connection — see ipc.go — so no additional synchronization is needed
// beyond the mutex already guarding cmd/cdpURL from the idle-sweep ticker
// goroutine).
func (b *headlessShellBrowser) CdpURL() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.cdpURL
}

func (b *headlessShellBrowser) Warm() error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.cmd != nil {
		return nil // already running — idempotent
	}

	cmd := exec.Command(b.execPath, append(launchArgs, "--user-data-dir="+b.userDataDir)...)
	configureProcessGroup(cmd) // see process_windows.go/process_unix.go — needed so Terminate() can kill the whole tree, not just this PID
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to open chrome-headless-shell stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start chrome-headless-shell: %w", err)
	}

	url, err := waitForDevtoolsURL(stderr, 15*time.Second)
	if err != nil {
		_ = killProcessTree(cmd)
		return fmt.Errorf("chrome-headless-shell did not produce a DevTools endpoint: %w", err)
	}

	b.cmd = cmd
	b.cdpURL = url
	b.logger.Info("chrome-headless-shell warmed", "cdpUrl", url)
	return nil
}

func (b *headlessShellBrowser) Terminate() error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.cmd == nil {
		return nil // already terminated — idempotent
	}

	// killProcessTree, not cmd.Process.Kill() — found via live testing that
	// Kill() alone only signals the top-level PID and orphans Chromium's own
	// renderer/GPU child processes (a real, observed idle-footprint leak,
	// not a hypothetical one). See process_windows.go/process_unix.go.
	err := killProcessTree(b.cmd)
	b.cmd = nil
	b.cdpURL = ""
	if err != nil {
		return fmt.Errorf("failed to terminate chrome-headless-shell: %w", err)
	}
	return nil
}

// Scans stderr line-by-line for the DevTools-listening line, off the
// caller's goroutine, with a hard timeout — a browser that hangs at launch
// (corrupt profile, missing shared libs) must not block Warm() forever.
func waitForDevtoolsURL(stderr io.Reader, timeout time.Duration) (string, error) {
	type result struct {
		url string
		err error
	}
	done := make(chan result, 1)

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			if match := devtoolsListeningRE.FindStringSubmatch(scanner.Text()); match != nil {
				done <- result{url: match[1]}
				return
			}
		}
		done <- result{err: fmt.Errorf("stderr closed before a DevTools endpoint appeared")}
	}()

	select {
	case r := <-done:
		return r.url, r.err
	case <-time.After(timeout):
		return "", fmt.Errorf("timed out after %s waiting for DevTools endpoint", timeout)
	}
}
