#!/bin/bash

# Create the config.json content
cat > /cockpit/config.json <<EOF
{
  "globalAddress": "${BASE_URL}",
  "mainConnectionURI": "${MAVLINK2REST_URI}",
  "_webRTCSignallingURI": "${WEBRTC_SIGNALING_URI}"
}
EOF

# Proceed to run the original command
exec "$@"
