"""Fotobox editor: python3 server.py; no third-party dependencies."""
import base64
import json
import os
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import uuid

ROOT = Path(__file__).parent / 'static'


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def reply(self, status, value):
        data = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == '/api/status':
            return self.reply(200, {'configured': bool(os.getenv('OPENAI_API_KEY'))})
        return super().do_GET()

    def do_POST(self):
        if self.path != '/api/generate':
            return self.reply(404, {'error': 'Nicht gefunden.'})
        key = os.getenv('OPENAI_API_KEY')
        if not key:
            return self.reply(503, {'error': 'Bilderstellung benötigt OPENAI_API_KEY auf dem Server. Eine ChatGPT-Anmeldung kann hierfür nicht verwendet werden.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 36_000_000:
                return self.reply(413, {'error': 'Anfrage zu groß (maximal 36 MB).'})
            body = json.loads(self.rfile.read(length))
            prompt = str(body.get('prompt', '')).strip()
            if not prompt or len(prompt) > 12000:
                return self.reply(400, {'error': 'Bitte eine Beschreibung mit maximal 12000 Zeichen eingeben.'})
            prompt = ('Create a decorative photo booth frame artwork. Keep the center visually quiet for a photo overlay. '
                      'Concentrate decorations along the outer edges. User instructions: ' + prompt)
            if body.get('hasBackground'):
                prompt += (' The FIRST reference image is the selected photo booth BACKGROUND. '
                           'Create a NEW frame whose palette, lighting, mood and decorative style complement this background. '
                           'Do not copy the background scene into the frame and do not generate people. '
                           'Any remaining reference images guide the frame decoration.')
            fields = {'model': 'gpt-image-1', 'prompt': prompt, 'size': '1536x1024', 'quality': 'medium'}
            images = body.get('images', [])
            if not isinstance(images, list) or len(images) > 5:
                raise ValueError('Maximal fünf Bilder inklusive Hintergrund erlaubt.')
            if images:
                boundary = uuid.uuid4().hex
                parts = []
                for name, value in fields.items():
                    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
                for i, image in enumerate(images):
                    raw = base64.b64decode(image['data'], validate=True)
                    if len(raw) > 5_000_000 or not raw.startswith(b'\x89PNG\r\n\x1a\n'):
                        raise ValueError('Referenzen müssen PNG-Bilder unter 5 MB sein.')
                    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image[]"; filename="reference-{i}.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + raw + b'\r\n')
                payload = b''.join(parts) + f'--{boundary}--\r\n'.encode()
                content_type = 'multipart/form-data; boundary=' + boundary
                endpoint = 'edits'
            else:
                payload = json.dumps(fields).encode()
                content_type = 'application/json'
                endpoint = 'generations'
            request = Request('https://api.openai.com/v1/images/' + endpoint, data=payload,
                              headers={'Authorization': 'Bearer ' + key, 'Content-Type': content_type})
            with urlopen(request, timeout=180) as response:
                result = json.load(response)
            self.reply(200, {'image': result['data'][0]['b64_json']})
        except HTTPError as exc:
            self.reply(502, {'error': f'OpenAI-Anfrage fehlgeschlagen (HTTP {exc.code}). Bitte API-Zugang, Guthaben und Modellberechtigung prüfen.'})
        except (ValueError, KeyError, TypeError):
            self.reply(400, {'error': 'Ungültige Bilddaten oder Anfrage.'})
        except (URLError, TimeoutError):
            self.reply(502, {'error': 'Der Bilddienst ist momentan nicht erreichbar. Bitte erneut versuchen.'})
        except Exception:
            self.reply(500, {'error': 'Die Bilderstellung ist fehlgeschlagen.'})


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', int(os.getenv('PORT', '8000'))), Handler).serve_forever()
