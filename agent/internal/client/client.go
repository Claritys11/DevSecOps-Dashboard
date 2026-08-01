package client

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	baseURL    string
	agentID    string
	secret     string
	httpClient *http.Client
}

func New(baseURL, agentID, secret string, timeout time.Duration) Client {
	return Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		agentID:    agentID,
		secret:     secret,
		httpClient: &http.Client{Timeout: timeout},
	}
}

func (c Client) Post(path string, payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt*attempt) * time.Second)
		}
		lastErr = c.postOnce(path, body)
		if lastErr == nil {
			return nil
		}
	}
	return lastErr
}

func (c Client) postOnce(path string, body []byte) error {
	request, err := http.NewRequest(http.MethodPost, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	hash := sha256.Sum256(body)
	request.Header.Set("content-type", "application/json")
	request.Header.Set("x-agent-id", c.agentID)
	request.Header.Set("x-agent-token", c.secret)
	request.Header.Set("x-agent-timestamp", time.Now().UTC().Format(time.RFC3339))
	request.Header.Set("x-agent-nonce", nonce())
	request.Header.Set("x-body-sha256", hex.EncodeToString(hash[:]))

	response, err := c.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("dashboard returned %s", response.Status)
	}
	return nil
}

func nonce() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(bytes)
}
