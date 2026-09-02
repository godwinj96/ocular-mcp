// Supervisor entrypoint. Owns the loopback IPC listener, the lifecycle
// state machine, and graceful shutdown. See
// docs/rules/13-local-worker-and-distribution.md §2 for the process
// architecture this fits into (Node MCP server -> loopback IPC ->
// supervisor -> chrome-headless-shell).
//
// BUILD NOTE (Windows): must be built with
//
//	go build -ldflags="-H windowsgui" -o ocular-supervisor.exe .
//
// A normally-built Go binary is a console app by default and will flash a
// black console window on launch — see rules-13 §4's invisibility table.
// packages/local-worker/package.json's build:supervisor:windows script
// already does this; never build this binary for distribution without it.
package main

import (
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"
)

// idleShutdownMinFlag lets the Node MCP server pass the threshold at spawn
// time, sourced from packages/shared/src/constants.ts's
// LOCAL_IDLE_SHUTDOWN_MIN — the supervisor itself never hardcodes it, so
// that TS file stays the single source of truth per rules-13 §3's own rule.
func main() {
	idleShutdownMin := flag.Int("idle-shutdown-min", 30, "minutes of inactivity before the browser is fully terminated")
	executablePath := flag.String("executable-path", "", "path to the chrome-headless-shell binary (required)")
	userDataDir := flag.String("user-data-dir", "", "persistent profile directory (required)")
	flag.Parse()

	// Logs go to stderr, not stdout — stdout's first line is reserved for
	// the LISTENING handshake the Node side parses (see below). Structured
	// JSON per docs/rules/09-error-handling-and-logging.md §3's spirit,
	// translated to Go idiom via log/slog.
	logger := slog.New(slog.NewJSONHandler(os.Stderr, nil))

	if *executablePath == "" || *userDataDir == "" {
		logger.Error("missing required flags", "executablePath", *executablePath, "userDataDir", *userDataDir)
		os.Exit(1)
	}

	ln, addr, err := listenLoopback()
	if err != nil {
		logger.Error("failed to open loopback listener", "error", err)
		os.Exit(1)
	}
	defer ln.Close()

	browser := newHeadlessShellBrowser(*executablePath, *userDataDir, logger)
	lifecycle := NewLifecycle(time.Duration(*idleShutdownMin)*time.Minute, browser)

	// Handshake: the Node MCP server spawns this binary and reads exactly
	// one line of stdout to learn the address to connect to. Nothing else
	// is ever written to stdout — it is not a general logging stream.
	fmt.Println("LISTENING " + addr)

	shutdown := make(chan struct{})

	go serveIpc(ln, logger, func(req IpcRequest) IpcResponse {
		switch req.Type {
		case "warm":
			if err := lifecycle.OnSessionStart(); err != nil {
				return IpcResponse{OK: false, Error: err.Error()}
			}
			return IpcResponse{OK: true, State: lifecycle.State().String(), CdpURL: browser.CdpURL()}
		case "capture_start":
			if err := lifecycle.OnCaptureStart(); err != nil {
				return IpcResponse{OK: false, Error: err.Error()}
			}
			return IpcResponse{OK: true, State: lifecycle.State().String(), CdpURL: browser.CdpURL()}
		case "capture_end":
			lifecycle.OnCaptureEnd()
			return IpcResponse{OK: true, State: lifecycle.State().String()}
		case "status":
			return IpcResponse{OK: true, State: lifecycle.State().String(), CdpURL: browser.CdpURL()}
		case "shutdown":
			close(shutdown)
			return IpcResponse{OK: true, State: lifecycle.State().String()}
		default:
			return IpcResponse{OK: false, Error: "unknown_request_type"}
		}
	})

	// Idle sweep — checked once a minute, not continuously; the threshold
	// itself is minutes-granularity so sub-minute precision buys nothing.
	idleTicker := time.NewTicker(60 * time.Second)
	defer idleTicker.Stop()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)

	for {
		select {
		case <-idleTicker.C:
			if err := lifecycle.CheckIdle(); err != nil {
				logger.Warn("idle check failed", "error", err)
			}
		case <-sigCh:
			logger.Info("received shutdown signal")
			_ = browser.Terminate()
			return
		case <-shutdown:
			logger.Info("received shutdown request over IPC")
			_ = browser.Terminate()
			return
		}
	}
}
