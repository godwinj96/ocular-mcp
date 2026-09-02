// Loopback-only IPC listener. See docs/rules/13-local-worker-and-distribution.md
// §4: "Bind the IPC socket to loopback only... Never bind 0.0.0.0."
//
// Implementation note (deviation from the doc's literal "Unix socket / named
// pipe" wording, worth flagging for review): Go's stdlib has no cross-platform
// named-pipe support — that needs a third-party module (e.g. microsoft/go-winio)
// which the rules doc's own rationale for choosing Go explicitly weighs against
// ("stdlib covers process management... without third-party dependencies").
// So this uses a real Unix domain socket via net.Listen("unix", ...) on
// macOS/Linux (stdlib-native, satisfies the doc exactly), and falls back to a
// TCP listener bound to 127.0.0.1 (never 0.0.0.0) on Windows. A loopback-bound
// TCP listener does not trigger the Windows Firewall "allow incoming
// connections?" prompt that rule exists to avoid — that prompt is specific to
// listening on a non-loopback interface — so the actual invisibility
// requirement is satisfied either way, even though the transport isn't
// literally a named pipe on Windows. Revisit if go-winio (or Go's stdlib
// gaining named-pipe support) makes the literal reading cheap to satisfy.
package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"os"
	"path/filepath"
	"runtime"
)

// IpcRequest / IpcResponse are newline-delimited JSON frames — the minimal
// wire protocol for Phase 2 (lifecycle-only). Phase 3 will extend this with
// capture-command payloads.
type IpcRequest struct {
	Type string `json:"type"` // "warm" | "capture_start" | "capture_end" | "status" | "shutdown"
}

type IpcResponse struct {
	OK    bool   `json:"ok"`
	State string `json:"state,omitempty"`
	Error string `json:"error,omitempty"`
	// CdpURL is the browser's current DevTools WebSocket endpoint, present
	// whenever the browser is warm (i.e. not in the Idle tier). Node
	// connects to this directly — the supervisor itself never speaks CDP
	// (see browser.go's header comment).
	CdpURL string `json:"cdpUrl,omitempty"`
}

// socketDir returns a per-user, non-world-readable directory to place the
// Unix domain socket in. Not used on Windows (TCP loopback path instead).
func socketDir() (string, error) {
	base, err := os.UserCacheDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, "ocular", "local-worker")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	return dir, nil
}

// listenLoopback opens the platform-appropriate loopback-only listener and
// returns it alongside the address string the Node MCP server needs to
// connect (written to stdout as the startup handshake — see main.go).
func listenLoopback() (net.Listener, string, error) {
	if runtime.GOOS == "windows" {
		ln, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			return nil, "", err
		}
		return ln, fmt.Sprintf("tcp:%s", ln.Addr().String()), nil
	}

	dir, err := socketDir()
	if err != nil {
		return nil, "", err
	}
	sockPath := filepath.Join(dir, fmt.Sprintf("supervisor-%d.sock", os.Getpid()))
	_ = os.Remove(sockPath) // stale socket from a crashed prior run
	ln, err := net.Listen("unix", sockPath)
	if err != nil {
		return nil, "", err
	}
	return ln, fmt.Sprintf("unix:%s", sockPath), nil
}

// serveIpc accepts connections until the listener is closed, dispatching
// each newline-delimited request to handle. One goroutine per connection —
// this is a low-traffic, single-client (the local MCP server) protocol, not
// something that needs a worker pool.
func serveIpc(ln net.Listener, logger *slog.Logger, handle func(IpcRequest) IpcResponse) {
	for {
		conn, err := ln.Accept()
		if err != nil {
			// Listener closed (shutdown) or a transient accept error —
			// either way, nothing left to do but stop accepting.
			return
		}
		go handleConn(conn, logger, handle)
	}
}

func handleConn(conn net.Conn, logger *slog.Logger, handle func(IpcRequest) IpcResponse) {
	defer conn.Close()
	scanner := bufio.NewScanner(conn)
	encoder := json.NewEncoder(conn)

	for scanner.Scan() {
		var req IpcRequest
		if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
			_ = encoder.Encode(IpcResponse{OK: false, Error: "invalid_json"})
			continue
		}

		resp := handle(req)
		if err := encoder.Encode(resp); err != nil {
			logger.Warn("failed writing ipc response", "error", err)
			return
		}

		if req.Type == "shutdown" {
			return
		}
	}

	if err := scanner.Err(); err != nil && err != io.EOF {
		logger.Warn("ipc connection read error", "error", err)
	}
}
