//go:build windows

// Process-tree management on Windows. Found via live testing (not a design
// assumption): cmd.Process.Kill() only signals the direct child PID —
// Chromium's own renderer/GPU subprocesses are left running, which would
// silently violate the ~10-15MB idle-footprint promise
// (docs/rules/13-local-worker-and-distribution.md §3) every time the
// supervisor "terminates" the browser. `taskkill /T /F` kills the whole
// process tree rooted at the given PID; Setpgid-based Unix job control
// (process_unix.go) doesn't exist on Windows.
package main

import (
	"os/exec"
	"strconv"
	"syscall"
)

// CREATE_NO_WINDOW — undocumented in Go's syscall package on Windows, so
// defined here directly (its value is a stable, public Win32 constant).
//
// Found via live testing, not anticipated by the original design: the
// supervisor's OWN console is correctly suppressed by its `-H windowsgui`
// build flag (see main.go's build note) — but that means the supervisor has
// NO console to hand down. chrome-headless-shell.exe is itself a
// console-subsystem binary; when a console-subsystem child is spawned from
// a process with no console of its own, Windows allocates the child a
// brand-new console window unless explicitly told not to. Observed directly
// as a visible console titled after chrome-headless-shell during testing —
// exactly the failure docs/rules/13-local-worker-and-distribution.md §4's
// invisibility table exists to prevent, just one level removed (the child's
// console, not the supervisor's).
const createNoWindow = 0x08000000

func configureProcessGroup(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: createNoWindow}
}

func killProcessTree(cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return nil
	}
	return exec.Command("taskkill", "/T", "/F", "/PID", strconv.Itoa(cmd.Process.Pid)).Run()
}
