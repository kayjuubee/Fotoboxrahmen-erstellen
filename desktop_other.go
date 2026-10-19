//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
)

func openBrowser(url string) {
	cmd := exec.Command("xdg-open", url)
	if cmd.Start() == nil {
		go cmd.Wait()
	}
}
func showError(message string) { fmt.Fprintln(os.Stderr, message) }
