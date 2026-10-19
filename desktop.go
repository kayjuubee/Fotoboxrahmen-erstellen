// Rahmenstudio's standalone server embeds the complete editor in one executable.
package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"embed"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"mime/multipart"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

//go:embed static/*
var assets embed.FS

type imageInput struct {
	Data string `json:"data"`
}
type generation struct {
	Prompt        string       `json:"prompt"`
	HasBackground bool         `json:"hasBackground"`
	Images        []imageInput `json:"images"`
}
type editor struct {
	mu     sync.RWMutex
	key    string
	token  string
	server *http.Server
	client *http.Client
}

func reply(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(value)
}
func fail(w http.ResponseWriter, status int, message string) {
	reply(w, status, map[string]string{"error": message})
}
func (a *editor) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/status", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			fail(w, 405, "Methode nicht erlaubt.")
			return
		}
		a.mu.RLock()
		configured := a.key != ""
		a.mu.RUnlock()
		reply(w, 200, map[string]any{"configured": configured, "desktop": true})
	})
	mux.HandleFunc("/api/desktop-session", func(w http.ResponseWriter, r *http.Request) {
		// A custom header prevents cross-origin form and script requests.
		if r.Method != "GET" || r.Header.Get("X-Rahmenstudio") != "desktop" {
			fail(w, 403, "Zugriff verweigert.")
			return
		}
		reply(w, 200, map[string]string{"token": a.token})
	})
	mux.HandleFunc("/api/settings", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			fail(w, 405, "Methode nicht erlaubt.")
			return
		}
		if r.Header.Get("X-Rahmenstudio-Token") != a.token {
			fail(w, 403, "Zugriff verweigert.")
			return
		}
		var body struct {
			Key string `json:"key"`
		}
		if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body) != nil {
			fail(w, 400, "Ungültige Eingabe.")
			return
		}
		a.mu.Lock()
		a.key = strings.TrimSpace(body.Key)
		a.mu.Unlock()
		reply(w, 200, map[string]bool{"configured": strings.TrimSpace(body.Key) != ""})
	})
	mux.HandleFunc("/api/shutdown", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" || r.Header.Get("X-Rahmenstudio-Token") != a.token {
			fail(w, 403, "Zugriff verweigert.")
			return
		}
		reply(w, 200, map[string]bool{"ok": true})
		go func() {
			time.Sleep(100 * time.Millisecond)
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			a.server.Shutdown(ctx)
		}()
	})
	mux.HandleFunc("/api/generate", a.generate)
	root, _ := fs.Sub(assets, "static")
	mux.Handle("/", http.FileServer(http.FS(root)))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Loopback-only binding plus host/origin checks protect the local API.
		if r.Host != a.server.Addr {
			fail(w, 403, "Unbekannter Host.")
			return
		}
		if origin := r.Header.Get("Origin"); origin != "" && origin != "http://"+a.server.Addr {
			fail(w, 403, "Unbekannter Ursprung.")
			return
		}
		if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
			fail(w, 403, "Zugriff verweigert.")
			return
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		mux.ServeHTTP(w, r)
	})
}
func (a *editor) generate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		fail(w, 405, "Methode nicht erlaubt.")
		return
	}
	a.mu.RLock()
	key := a.key
	a.mu.RUnlock()
	if key == "" {
		fail(w, 503, "Bitte unter API-Einstellungen einen OpenAI-API-Schlüssel für diese Sitzung hinterlegen. Eine ChatGPT-Anmeldung ersetzt ihn nicht.")
		return
	}
	var body generation
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 36_000_000)).Decode(&body); err != nil {
		fail(w, 400, "Ungültige Anfrage oder zu große Bilddaten.")
		return
	}
	if strings.TrimSpace(body.Prompt) == "" || len([]rune(body.Prompt)) > 12000 || len(body.Images) > 5 {
		fail(w, 400, "Bitte Beschreibung und maximal fünf Referenzbilder prüfen.")
		return
	}
	prompt := "Create a decorative photo booth frame artwork. Keep the center visually quiet for a photo overlay. Concentrate decorations along the outer edges. User instructions: " + body.Prompt
	if body.HasBackground {
		prompt += " The FIRST reference image is the selected photo booth BACKGROUND. Create a NEW frame whose palette, lighting, mood and decorative style complement this background. Do not copy the background scene into the frame and do not generate people. Any remaining reference images guide frame decoration."
	}
	fields := map[string]string{"model": "gpt-image-1", "prompt": prompt, "size": "1536x1024", "quality": "medium"}
	var payload bytes.Buffer
	contentType := "application/json"
	endpoint := "generations"
	if len(body.Images) > 0 {
		endpoint = "edits"
		multi := multipart.NewWriter(&payload)
		for k, v := range fields {
			multi.WriteField(k, v)
		}
		for i, img := range body.Images {
			raw, err := base64.StdEncoding.DecodeString(img.Data)
			if err != nil || len(raw) > 5_000_000 || !bytes.HasPrefix(raw, []byte("\x89PNG\r\n\x1a\n")) {
				fail(w, 400, "Referenzbilder müssen PNGs unter 5 MB sein.")
				return
			}
			part, err := multi.CreateFormFile("image[]", fmt.Sprintf("reference-%d.png", i))
			if err != nil {
				fail(w, 500, "Bildverarbeitung fehlgeschlagen.")
				return
			}
			part.Write(raw)
		}
		multi.Close()
		contentType = multi.FormDataContentType()
	} else {
		json.NewEncoder(&payload).Encode(fields)
	}
	req, err := http.NewRequestWithContext(r.Context(), "POST", "https://api.openai.com/v1/images/"+endpoint, &payload)
	if err != nil {
		fail(w, 500, "Anfrage konnte nicht erstellt werden.")
		return
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", contentType)
	resp, err := a.client.Do(req)
	if err != nil {
		fail(w, 502, "OpenAI ist nicht erreichbar. Internetverbindung prüfen oder erneut versuchen.")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		fail(w, 502, fmt.Sprintf("OpenAI-Anfrage fehlgeschlagen (HTTP %d). API-Schlüssel, Guthaben und Modellzugriff prüfen.", resp.StatusCode))
		return
	}
	var result struct {
		Data []struct {
			Image string `json:"b64_json"`
		} `json:"data"`
	}
	if json.NewDecoder(io.LimitReader(resp.Body, 50_000_000)).Decode(&result) != nil || len(result.Data) == 0 || result.Data[0].Image == "" {
		fail(w, 502, "OpenAI hat kein gültiges Bild geliefert.")
		return
	}
	reply(w, 200, map[string]string{"image": result.Data[0].Image})
}
func main() {
	address := "127.0.0.1:18765"
	if port := os.Getenv("RAHMENSTUDIO_PORT"); port != "" {
		address = net.JoinHostPort("127.0.0.1", port)
	}
	ln, err := net.Listen("tcp", address)
	if err != nil {
		// Reopen an existing copy instead of changing the origin and losing its library.
		client := http.Client{Timeout: 2 * time.Second}
		resp, e := client.Get("http://" + address + "/api/status")
		if e == nil {
			defer resp.Body.Close()
			var s struct {
				Desktop bool `json:"desktop"`
			}
			if json.NewDecoder(resp.Body).Decode(&s) == nil && s.Desktop {
				openBrowser("http://" + address)
				return
			}
		}
		showError("Rahmenstudio konnte nicht starten. Port 18765 ist belegt. Bitte das andere Programm schließen oder RAHMENSTUDIO_PORT setzen.")
		return
	}
	token := make([]byte, 32)
	if _, err = rand.Read(token); err != nil {
		ln.Close()
		showError("Sitzung konnte nicht erstellt werden.")
		return
	}
	a := &editor{key: os.Getenv("OPENAI_API_KEY"), token: hex.EncodeToString(token), client: &http.Client{Timeout: 180 * time.Second}}
	a.server = &http.Server{Addr: ln.Addr().String(), ReadHeaderTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second}
	a.server.Handler = a.handler()
	if os.Getenv("RAHMENSTUDIO_NO_BROWSER") == "" {
		go openBrowser("http://" + a.server.Addr)
	}
	if err = a.server.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
		showError("Rahmenstudio: " + err.Error())
	}
}
