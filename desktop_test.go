package main

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type roundTrip func(*http.Request) (*http.Response, error)

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func appForTest() *editor {
	return &editor{token: "test-session-token", server: &http.Server{Addr: "127.0.0.1:18765"}, client: http.DefaultClient}
}
func request(a *editor, method, path, body string, headers map[string]string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "http://127.0.0.1:18765"+path, strings.NewReader(body))
	for k, v := range headers {
		r.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	a.handler().ServeHTTP(w, r)
	return w
}
func TestDesktopAssetsAndSettings(t *testing.T) {
	a := appForTest()
	for _, path := range []string{"/", "/app.js", "/scene.js", "/desktop.js", "/manual.js", "/style.css"} {
		if w := request(a, "GET", path, "", nil); w.Code != 200 {
			t.Fatalf("%s: %d", path, w.Code)
		}
	}
	if w := request(a, "POST", "/api/settings", `{"key":"secret-test-key"}`, nil); w.Code != 403 || a.key != "" {
		t.Fatal("settings accepted without token")
	}
	w := request(a, "POST", "/api/settings", `{"key":"secret-test-key"}`, map[string]string{"X-Rahmenstudio-Token": a.token})
	if w.Code != 200 || a.key != "secret-test-key" {
		t.Fatal("settings not applied")
	}
	w = request(a, "GET", "/api/status", "", nil)
	if !strings.Contains(w.Body.String(), `"configured":true`) || strings.Contains(w.Body.String(), "secret-test-key") {
		t.Fatal("status missing configuration or exposing key")
	}
	if w = request(a, "GET", "/api/desktop-session", "", nil); w.Code != 403 {
		t.Fatal("session unprotected")
	}
	if w = request(a, "GET", "/api/desktop-session", "", map[string]string{"X-Rahmenstudio": "desktop"}); !strings.Contains(w.Body.String(), a.token) {
		t.Fatal("session unavailable")
	}
	for _, headers := range []map[string]string{{"Origin": "https://foreign.example"}, {"Host": "foreign.example"}, {"Sec-Fetch-Site": "cross-site"}} {
		r := httptest.NewRequest("GET", "http://127.0.0.1:18765/api/status", nil)
		for k, v := range headers {
			if k == "Host" {
				r.Host = v
			} else {
				r.Header.Set(k, v)
			}
		}
		w = httptest.NewRecorder()
		a.handler().ServeHTTP(w, r)
		if w.Code != 403 {
			t.Fatal("foreign origin/host accepted")
		}
	}
	if w = request(a, "POST", "/api/shutdown", "", nil); w.Code != 403 {
		t.Fatal("unauthorized shutdown accepted")
	}
}
func TestGenerationRequiresKeyAndValidImages(t *testing.T) {
	a := appForTest()
	if w := request(a, "POST", "/api/generate", `{"prompt":"flowers"}`, nil); w.Code != 503 {
		t.Fatal("missing key not reported")
	}
	a.key = "test-key"
	for _, body := range []string{`{}`, `{"prompt":"flowers","images":[{"data":"invalid"}]}`} {
		if w := request(a, "POST", "/api/generate", body, nil); w.Code != 400 {
			t.Fatalf("invalid request accepted: %d", w.Code)
		}
	}
}
func TestGenerationSendsBackgroundAndReferences(t *testing.T) {
	a := appForTest()
	a.key = "test-key"
	a.client = &http.Client{Transport: roundTrip(func(r *http.Request) (*http.Response, error) {
		if !strings.HasSuffix(r.URL.Path, "/images/edits") || r.Header.Get("Authorization") != "Bearer test-key" {
			t.Fatal("incorrect upstream request")
		}
		if err := r.ParseMultipartForm(36_000_000); err != nil {
			t.Fatal(err)
		}
		if len(r.MultipartForm.File["image[]"]) != 5 {
			t.Fatal("missing references")
		}
		if !strings.Contains(r.FormValue("prompt"), "FIRST reference image") || !strings.Contains(r.FormValue("prompt"), "do not generate people") {
			t.Fatal("missing background instructions")
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"data":[{"b64_json":"generated-image"}]}`)), Header: make(http.Header)}, nil
	})}
	image := imageInput{Data: base64.StdEncoding.EncodeToString([]byte("\x89PNG\r\n\x1a\nfixture"))}
	body, _ := json.Marshal(generation{Prompt: "flowers", HasBackground: true, Images: []imageInput{image, image, image, image, image}})
	w := request(a, "POST", "/api/generate", string(body), nil)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "generated-image") {
		t.Fatalf("generation failed: %s", w.Body.String())
	}
}
func TestGenerationWithoutImagesAndUpstreamFailure(t *testing.T) {
	a := appForTest()
	a.key = "test-key"
	a.client = &http.Client{Transport: roundTrip(func(r *http.Request) (*http.Response, error) {
		if !strings.HasSuffix(r.URL.Path, "/images/generations") {
			t.Fatal("wrong endpoint")
		}
		var fields map[string]string
		if err := json.NewDecoder(r.Body).Decode(&fields); err != nil || fields["model"] != "gpt-image-1" {
			t.Fatal("wrong model or invalid JSON")
		}
		return &http.Response{StatusCode: 401, Body: io.NopCloser(strings.NewReader("upstream detail")), Header: make(http.Header)}, nil
	})}
	w := request(a, "POST", "/api/generate", `{"prompt":"flowers"}`, nil)
	if w.Code != 502 || !strings.Contains(w.Body.String(), "401") || strings.Contains(w.Body.String(), "upstream detail") {
		t.Fatal("upstream error not handled safely")
	}
}
