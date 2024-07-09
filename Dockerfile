FROM alpine:3.19

ARG TARGETARCH
# Install simple http server
RUN apk add --no-cache wget
RUN if [ "$TARGETARCH" = "amd64" ]; then \
        wget https://github.com/TheWaWaR/simple-http-server/releases/download/v0.6.6/x86_64-unknown-linux-musl-simple-http-server -O /usr/bin/simple-http-server; \
    elif [ "$TARGETARCH" = "arm64" ]; then \
        wget https://github.com/TheWaWaR/simple-http-server/releases/download/v0.6.6/aarch64-unknown-linux-musl-simple-http-server -O /usr/bin/simple-http-server; \
    elif [ "$TARGETARCH" = "arm" ]; then \
        wget https://github.com/TheWaWaR/simple-http-server/releases/download/v0.6.6/armv7-unknown-linux-musleabihf-simple-http-server -O /usr/bin/simple-http-server; \
    else \
        echo "Unsupported architecture: $TARGETARCH"; exit 1; \
    fi

RUN chmod +x /usr/bin/simple-http-server

LABEL authors='[\
    {\
        "name": "Rafael Araujo Lehmkuhl",\
        "email": "rafael@bluerobotics.com"\
    },\
    {\
        "name": "Patrick José Pereira",\
        "email": "patrick@bluerobotics.com"\
    }\
]'
LABEL company='{\
        "about": "",\
        "name": "Blue Robotics",\
        "email": "support@bluerobotics.com"\
    }'
LABEL permissions='{\
  "ExposedPorts": {\
    "8000/tcp": {}\
  },\
  "HostConfig": {\
    "PortBindings": {\
      "8000/tcp": [\
        {\
          "HostPort": ""\
        }\
      ]\
    }\
  }\
}'
LABEL type="other"
LABEL tags='[\
        "vehicle-control",\
        "control-station",\
        "ground-station",\
        "navigation",\
        "joystick",\
        "mission-planning"\
    ]'
LABEL links='{\
        "support": "https://discuss.bluerobotics.com/c/bluerobotics-software"\
    }'
LABEL readme="https://raw.githubusercontent.com/bluerobotics/cockpit/master/README.md"


COPY ./dist /cockpit
ENTRYPOINT ["simple-http-server", "--index", "cockpit"]
