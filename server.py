#!/usr/bin/env python3
"""Servidor mínimo para visualizar index.html en plataformas con preview por puerto."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os

PORT = int(os.environ.get("PORT", "8000"))
HOST = os.environ.get("HOST", "0.0.0.0")

if __name__ == "__main__":
    httpd = ThreadingHTTPServer((HOST, PORT), SimpleHTTPRequestHandler)
    print(f"Sirviendo en http://{HOST}:{PORT}")
    httpd.serve_forever()
