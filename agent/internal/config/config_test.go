package config

import (
	"testing"
	"time"
)

func TestLoadRequiresExplicitCredentials(t *testing.T) {
	t.Setenv("DASHBOARD_URL", "http://dashboard.example.test")
	t.Setenv("AGENT_ID", "primary-linux-agent")
	t.Setenv("AGENT_SECRET", "")

	if _, err := Load(); err == nil {
		t.Fatal("expected missing AGENT_SECRET to fail")
	}
}

func TestLoadRejectsPlaceholderSecret(t *testing.T) {
	t.Setenv("DASHBOARD_URL", "http://dashboard.example.test")
	t.Setenv("AGENT_ID", "primary-linux-agent")
	t.Setenv("AGENT_SECRET", "change-me-agent-token")

	if _, err := Load(); err == nil {
		t.Fatal("expected placeholder AGENT_SECRET to fail")
	}
}

func TestLoadParsesValidConfig(t *testing.T) {
	t.Setenv("DASHBOARD_URL", "http://dashboard.example.test/")
	t.Setenv("AGENT_ID", "primary-linux-agent")
	t.Setenv("AGENT_SECRET", "real-agent-token-value")
	t.Setenv("COLLECTION_INTERVAL_SECONDS", "45")
	t.Setenv("REQUEST_TIMEOUT_SECONDS", "7")
	t.Setenv("SERVER_NAME", "generic-linux-host")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected valid config, got %v", err)
	}

	if cfg.DashboardURL != "http://dashboard.example.test" {
		t.Fatalf("unexpected DashboardURL %q", cfg.DashboardURL)
	}
	if cfg.Interval != 45*time.Second {
		t.Fatalf("unexpected interval %s", cfg.Interval)
	}
	if cfg.Timeout != 7*time.Second {
		t.Fatalf("unexpected timeout %s", cfg.Timeout)
	}
	if cfg.ServerName != "generic-linux-host" {
		t.Fatalf("unexpected server name %q", cfg.ServerName)
	}
}
