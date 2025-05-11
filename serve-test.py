#!/usr/bin/env python3

import os
import http.server
import socketserver
from urllib.parse import urlparse

PORT = 8000

# Extended SimpleHTTPRequestHandler to add CORS headers
class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def send_response(self, code, message=None):
        super().send_response(code, message)
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type')

    def end_headers(self):
        # Make sure proper mime types are set for different files
        # This is especially important for JS and CSS files
        path = self.path
        if path.endswith('.js'):
            self.send_header('Content-Type', 'application/javascript')
        elif path.endswith('.css'):
            self.send_header('Content-Type', 'text/css')
        elif path.endswith('.html'):
            self.send_header('Content-Type', 'text/html')
        elif path.endswith('.json'):
            self.send_header('Content-Type', 'application/json')
        super().end_headers()
    
    def do_OPTIONS(self):
        # Handle OPTIONS requests for CORS preflight
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        print(f"GET request: {self.path}")
        # Normalize URL with or without .html extension
        path = self.path
        if path.endswith('/'):
            path += 'index.html'
        
        # Attempt to serve the file
        super().do_GET()

with socketserver.TCPServer(("", PORT), CORSHTTPRequestHandler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    print("Press Ctrl+C to stop")
    httpd.serve_forever() 