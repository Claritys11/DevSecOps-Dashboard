package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	DashboardURL string
	AgentID      string
	AgentSecret  string
	Interval     time.Duration
	Timeout      time.Duration
	ServerName   string
}

func Load() (Config, error) {
	interval := intEnv("COLLECTION_INTERVAL_SECONDS", 30)
	timeout := intEnv("REQUEST_TIMEOUT_SECONDS", 10)
	cfg := Config{
		DashboardURL: strings.TrimRight(os.Getenv("DASHBOARD_URL"), "/"),
		AgentID:      os.Getenv("AGENT_ID"),
		AgentSecret:  os.Getenv("AGENT_SECRET"),
		Interval:     time.Duration(interval) * time.Second,
		Timeout:      time.Duration(timeout) * time.Second,
		ServerName:   os.Getenv("SERVER_NAME"),
	}

	if cfg.DashboardURL == "" {
		return Config{}, fmt.Errorf("DASHBOARD_URL is required")
	}
	if !strings.HasPrefix(cfg.DashboardURL, "http://") && !strings.HasPrefix(cfg.DashboardURL, "https://") {
		return Config{}, fmt.Errorf("DASHBOARD_URL must start with http:// or https://")
	}
	if cfg.AgentID == "" {
		return Config{}, fmt.Errorf("AGENT_ID is required")
	}
	if cfg.AgentSecret == "" || isPlaceholder(cfg.AgentSecret) {
		return Config{}, fmt.Errorf("AGENT_SECRET must be set to a non-placeholder secret")
	}
	return cfg, nil
}

func intEnv(key string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(key))
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func isPlaceholder(value string) bool {
	normalized := strings.TrimSpace(value)
	return normalized == "change-me-agent-token" ||
		normalized == "change-me-cachyos-agent-token" ||
		normalized == "change-me-ubuntu-nspawn-agent-token" ||
		strings.HasPrefix(normalized, "change-me-") ||
		strings.HasPrefix(normalized, "replace-with-")
}
