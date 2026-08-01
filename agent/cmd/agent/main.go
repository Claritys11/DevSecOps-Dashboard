package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"devsecops-dashboard-agent/internal/client"
	"devsecops-dashboard-agent/internal/collector"
	"devsecops-dashboard-agent/internal/config"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg := config.Load()
	api := client.New(cfg.DashboardURL, cfg.AgentID, cfg.AgentSecret, cfg.Timeout)
	system := &collector.Collector{}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	heartbeat, err := system.Heartbeat(cfg.ServerName)
	if err != nil {
		logger.Error("heartbeat collection failed", "error", err)
		os.Exit(1)
	}
	if err := api.Post("/api/agents/heartbeat", heartbeat); err != nil {
		logger.Warn("heartbeat send failed", "error", err)
	} else {
		logger.Info("heartbeat sent")
	}

	ticker := time.NewTicker(cfg.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			logger.Info("agent shutdown")
			return
		case <-ticker.C:
			metric, err := system.Metrics(cfg.ServerName)
			if err != nil {
				logger.Error("metric collection failed", "error", err)
				continue
			}
			if err := api.Post("/api/agents/metrics", metric); err != nil {
				raw, _ := json.Marshal(metric)
				logger.Warn("metric send failed", "error", err, "bytes", len(raw))
				continue
			}
			logger.Info("metric sent", "collectionId", metric.CollectionID)
		}
	}
}
