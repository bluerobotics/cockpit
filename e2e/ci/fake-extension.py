"""A stand-in BlueOS extension offering Cockpit extras: a widget, an HTTP action and a joystick suggestion for it.

Run inside the BlueOS container, whose helper finds any web service answering /register_service and serves it under
/extensionv2/<name>. The container has no Docker socket, so a real extension cannot be installed there. The names are
the ones e2e/lib/extensions.mjs uses.

Usage: python3 fake-extension.py PORT
"""
import base64
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

NAME = 'e2e'
ACTION_ID = 'e2e-ping-all'
ACTION_NAME = 'E2E Ping (All)'

REGISTER = {
    'name': NAME,
    'description': 'Cockpit end-to-end test extension',
    'icon': 'mdi-test-tube',
    'company': 'Blue Robotics',
    'version': '1.0.0',
    'webpage': '',
    'api': '',
    'works_in_relative_paths': True,
    'extras': {'cockpit': '/cockpit_extras.json'},
}

EXTRAS = {
    'targetSystem': 'Cockpit',
    'targetCockpitApiVersion': '1.0.0',
    'widgets': [{'name': 'E2E Extension', 'iframeUrl': '/', 'iconUrl': '/favicon.png', 'useExtensionPathAsBaseUrl': True}],
    'actions': [
        {
            'id': ACTION_ID,
            'name': ACTION_NAME,
            'type': 'http-request',
            'config': {
                'name': ACTION_NAME,
                'url': f'http://{{{{ vehicle-address }}}}/extensionv2/{NAME}/v1/action',
                'method': 'POST',
                'headers': {'Content-Type': 'application/json'},
                'urlParams': {},
                # Names the action, so a case can tell the request carried the body the action was given.
                'body': json.dumps({'action': ACTION_ID}),
            },
        }
    ],
    'joystickSuggestions': [
        {
            'id': 'e2e-any-vehicle',
            'name': 'E2E on any vehicle types',
            'buttonMappingSuggestions': [
                {
                    'id': 'e2e-ping-on-10',
                    'actionProtocol': 'cockpit-action',
                    'actionName': ACTION_NAME,
                    'actionId': ACTION_ID,
                    'button': 10,
                    'modifierKey': 'regular',
                }
            ],
        }
    ],
}

# The widget's page loads a script from assets/, as a built extension frontend does.
PAGES = {
    '/': ('text/html', b'<!doctype html><title>E2E extension</title><h1>E2E extension</h1><script src="assets/app.js"></script>'),
    '/assets/app.js': ('text/javascript', b'document.body.dataset.loaded = "true"'),
    '/favicon.png': (
        'image/png',
        base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/eL9GtQAAAABJRU5ErkJggg=='),
    ),
    '/register_service': ('application/json', json.dumps(REGISTER).encode()),
    '/cockpit_extras.json': ('application/json', json.dumps(EXTRAS).encode()),
}


class Handler(BaseHTTPRequestHandler):
    def reply(self, code, kind='application/json', body=b''):
        self.send_response(code)
        self.send_header('Content-Type', kind)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Methods', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        page = PAGES.get(self.path.split('?')[0])
        self.reply(200, *page) if page else self.reply(404)

    def do_POST(self):
        self.reply(200, body=b'{}') if self.path.split('?')[0] == '/v1/action' else self.reply(404)

    def do_OPTIONS(self):
        self.reply(204)


ThreadingHTTPServer(('0.0.0.0', int(sys.argv[1])), Handler).serve_forever()
