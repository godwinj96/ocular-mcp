package main

import (
	"strings"
	"testing"
	"time"
)

func TestWaitForDevtoolsURLParsesTheListeningLine(t *testing.T) {
	stderr := strings.NewReader(
		"[1234:5678:0101/000000.000000:INFO:CONSOLE.cc(1)] some noise\n" +
			"DevTools listening on ws://127.0.0.1:9999/devtools/browser/abc-123\n" +
			"[more noise after]\n",
	)

	url, err := waitForDevtoolsURL(stderr, time.Second)
	if err != nil {
		t.Fatalf("waitForDevtoolsURL: %v", err)
	}
	if url != "ws://127.0.0.1:9999/devtools/browser/abc-123" {
		t.Fatalf("unexpected url: %q", url)
	}
}

func TestWaitForDevtoolsURLIgnoresUnrelatedLines(t *testing.T) {
	stderr := strings.NewReader(
		"just some startup noise\n" +
			"another line\n" +
			"DevTools listening on ws://127.0.0.1:1/devtools/browser/xyz\n",
	)

	url, err := waitForDevtoolsURL(stderr, time.Second)
	if err != nil {
		t.Fatalf("waitForDevtoolsURL: %v", err)
	}
	if url != "ws://127.0.0.1:1/devtools/browser/xyz" {
		t.Fatalf("unexpected url: %q", url)
	}
}

func TestWaitForDevtoolsURLErrorsWhenStderrClosesWithoutTheLine(t *testing.T) {
	stderr := strings.NewReader("chrome crashed immediately\nno devtools line here\n")

	_, err := waitForDevtoolsURL(stderr, time.Second)
	if err == nil {
		t.Fatal("expected an error when stderr closes without a DevTools line")
	}
}

func TestWaitForDevtoolsURLTimesOutOnAHangingProcess(t *testing.T) {
	// blockingReader never returns, simulating a process that started but
	// never printed anything and never exited — waitForDevtoolsURL must not
	// hang forever waiting on it.
	_, err := waitForDevtoolsURL(&blockingReader{}, 50*time.Millisecond)
	if err == nil {
		t.Fatal("expected a timeout error")
	}
}

type blockingReader struct{}

func (b *blockingReader) Read(p []byte) (int, error) {
	select {} // block forever
}
