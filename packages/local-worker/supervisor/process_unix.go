//go:build !windows

// Process-tree management on macOS/Linux — see process_windows.go's header
// comment for why this exists at all (cmd.Process.Kill() alone orphans
// Chromium's child processes). Setpgid puts the browser and everything it
// spawns into a new process group; killing the negative PID signals the
// whole group in one syscall.
package main

import (
	"os/exec"
	"syscall"
)

func configureProcessGroup(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

func killProcessTree(cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return nil
	}
	return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
}
