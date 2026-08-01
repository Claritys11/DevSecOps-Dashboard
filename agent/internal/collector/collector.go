package collector

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const AgentVersion = "0.1.0"

type Payload struct {
	CollectionID        string  `json:"collectionId,omitempty"`
	AgentVersion        string  `json:"agentVersion"`
	Hostname            string  `json:"hostname"`
	OS                  string  `json:"os"`
	Kernel              string  `json:"kernel"`
	Architecture        string  `json:"architecture"`
	UptimeSeconds       uint64  `json:"uptimeSeconds"`
	CPUUsagePercent     float64 `json:"cpuUsagePercent"`
	CPUCoreCount        int     `json:"cpuCoreCount"`
	MemoryTotalMb       float64 `json:"memoryTotalMb"`
	MemoryUsedMb        float64 `json:"memoryUsedMb"`
	MemoryUsagePercent  float64 `json:"memoryUsagePercent"`
	SwapTotalMb         float64 `json:"swapTotalMb"`
	SwapUsedMb          float64 `json:"swapUsedMb"`
	StorageTotalGb      float64 `json:"storageTotalGb"`
	StorageUsedGb       float64 `json:"storageUsedGb"`
	StorageUsagePercent float64 `json:"storageUsagePercent"`
	LoadAverage1        float64 `json:"loadAverage1"`
	LoadAverage5        float64 `json:"loadAverage5"`
	LoadAverage15       float64 `json:"loadAverage15"`
	NetworkRxBytes      uint64  `json:"networkRxBytes"`
	NetworkTxBytes      uint64  `json:"networkTxBytes"`
	CollectedAt         string  `json:"collectedAt"`
}

type Collector struct {
	prevTotal uint64
	prevIdle  uint64
}

func (c *Collector) Heartbeat(serverName string) (Payload, error) {
	base, err := basePayload(serverName)
	if err != nil {
		return Payload{}, err
	}
	return base, nil
}

func (c *Collector) Metrics(serverName string) (Payload, error) {
	payload, err := basePayload(serverName)
	if err != nil {
		return Payload{}, err
	}
	payload.CollectionID = randomID()
	payload.UptimeSeconds, _ = uptime()
	payload.CPUCoreCount = runtime.NumCPU()
	payload.CPUUsagePercent = c.cpuUsage()
	payload.MemoryTotalMb, payload.MemoryUsedMb, payload.MemoryUsagePercent, payload.SwapTotalMb, payload.SwapUsedMb = memory()
	payload.StorageTotalGb, payload.StorageUsedGb, payload.StorageUsagePercent = disk("/")
	payload.LoadAverage1, payload.LoadAverage5, payload.LoadAverage15 = loadavg()
	payload.NetworkRxBytes, payload.NetworkTxBytes = network()
	return payload, nil
}

func basePayload(serverName string) (Payload, error) {
	hostname := serverName
	if hostname == "" {
		value, err := os.Hostname()
		if err != nil {
			return Payload{}, err
		}
		hostname = value
	}
	return Payload{
		AgentVersion: AgentVersion,
		Hostname:     hostname,
		OS:           readFirstLine("/etc/os-release", "PRETTY_NAME"),
		Kernel:       readKernel(),
		Architecture: runtime.GOARCH,
		CollectedAt:  time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func readFirstLine(path, key string) string {
	file, err := os.Open(path)
	if err != nil {
		return runtime.GOOS
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	prefix := key + "="
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, prefix) {
			return strings.Trim(strings.TrimPrefix(line, prefix), `"`)
		}
	}
	return runtime.GOOS
}

func readKernel() string {
	data, err := os.ReadFile("/proc/sys/kernel/osrelease")
	if err != nil {
		return "unknown"
	}
	return strings.TrimSpace(string(data))
}

func uptime() (uint64, error) {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0, err
	}
	value, err := strconv.ParseFloat(strings.Fields(string(data))[0], 64)
	return uint64(value), err
}

func (c *Collector) cpuUsage() float64 {
	total, idle, err := cpuTimes()
	if err != nil {
		return 0
	}
	if c.prevTotal == 0 {
		c.prevTotal, c.prevIdle = total, idle
		return 0
	}
	totalDelta := total - c.prevTotal
	idleDelta := idle - c.prevIdle
	c.prevTotal, c.prevIdle = total, idle
	if totalDelta == 0 {
		return 0
	}
	return float64(totalDelta-idleDelta) / float64(totalDelta) * 100
}

func cpuTimes() (uint64, uint64, error) {
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0, 0, err
	}
	fields := strings.Fields(strings.SplitN(string(data), "\n", 2)[0])
	if len(fields) < 5 {
		return 0, 0, fmt.Errorf("invalid /proc/stat")
	}
	var total uint64
	for _, field := range fields[1:] {
		value, _ := strconv.ParseUint(field, 10, 64)
		total += value
	}
	idle, _ := strconv.ParseUint(fields[4], 10, 64)
	return total, idle, nil
}

func memory() (float64, float64, float64, float64, float64) {
	values := map[string]float64{}
	file, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, 0, 0, 0, 0
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) >= 2 {
			value, _ := strconv.ParseFloat(fields[1], 64)
			values[strings.TrimSuffix(fields[0], ":")] = value / 1024
		}
	}
	total := values["MemTotal"]
	available := values["MemAvailable"]
	used := total - available
	percent := 0.0
	if total > 0 {
		percent = used / total * 100
	}
	swapTotal := values["SwapTotal"]
	swapUsed := swapTotal - values["SwapFree"]
	return total, used, percent, swapTotal, swapUsed
}

func disk(path string) (float64, float64, float64) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return 0, 0, 0
	}
	total := float64(stat.Blocks*uint64(stat.Bsize)) / 1024 / 1024 / 1024
	free := float64(stat.Bavail*uint64(stat.Bsize)) / 1024 / 1024 / 1024
	used := total - free
	percent := 0.0
	if total > 0 {
		percent = used / total * 100
	}
	return total, used, percent
}

func loadavg() (float64, float64, float64) {
	data, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return 0, 0, 0
	}
	fields := strings.Fields(string(data))
	if len(fields) < 3 {
		return 0, 0, 0
	}
	l1, _ := strconv.ParseFloat(fields[0], 64)
	l5, _ := strconv.ParseFloat(fields[1], 64)
	l15, _ := strconv.ParseFloat(fields[2], 64)
	return l1, l5, l15
}

func network() (uint64, uint64) {
	file, err := os.Open("/proc/net/dev")
	if err != nil {
		return 0, 0
	}
	defer file.Close()
	var rx, tx uint64
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.Contains(line, ":") {
			continue
		}
		parts := strings.Split(line, ":")
		name := strings.TrimSpace(parts[0])
		if name == "lo" {
			continue
		}
		fields := strings.Fields(parts[1])
		if len(fields) >= 16 {
			r, _ := strconv.ParseUint(fields[0], 10, 64)
			t, _ := strconv.ParseUint(fields[8], 10, 64)
			rx += r
			tx += t
		}
	}
	return rx, tx
}

func randomID() string {
	bytes := make([]byte, 12)
	if _, err := rand.Read(bytes); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 10)
	}
	return hex.EncodeToString(bytes)
}
