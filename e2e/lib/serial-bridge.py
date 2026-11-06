"""Expose a TCP MAVLink stream as a serial port: prints the pty path, then relays bytes both ways.

Usage: python3 serial-bridge.py HOST PORT. Runs until either side closes or it is killed.
"""
import os
import pty
import select
import socket
import sys
import tty

master, slave = pty.openpty()
tty.setraw(slave)
# Until Cockpit opens the port nothing drains it, so bytes that do not fit are dropped instead of blocking.
os.set_blocking(master, False)
link = socket.create_connection((sys.argv[1], int(sys.argv[2])), timeout=5)
link.settimeout(None)
print(os.ttyname(slave), flush=True)

while True:
    ready, _, _ = select.select([master, link], [], [])
    if master in ready:
        try:
            data = os.read(master, 4096)
        except OSError:
            # No one has the serial side open yet (or it was just closed); wait for the next open.
            select.select([link], [], [], 0.2)
            continue
        link.sendall(data)
    if link in ready:
        data = link.recv(4096)
        if not data:
            break
        try:
            os.write(master, data)
        except BlockingIOError:
            pass
