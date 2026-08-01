package config

import (
	"os"
	"strconv"
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

func Load() Config {
	interval := intEnv("COLLECTION_INTERVAL_SECONDS", 30)
	timeout := intEnv("REQUEST_TIMEOUT_SECONDS", 10)
	return Config{
		DashboardURL: stringEnv("DASHBOARD_URL", "http://localhost:3003"),
		AgentID:      stringEnv("AGENT_ID", "cachyos-host-agent"),
		AgentSecret:  stringEnv("AGENT_SECRET", "change-me-cachyos-agent-token"),
		Interval:     time.Duration(interval) * time.Second,
		Timeout:      time.Duration(timeout) * time.Second,
		ServerName:   os.Getenv("SERVER_NAME"),
	}
}

func stringEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func intEnv(key string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(key))
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}
