# Build frontend
FROM --platform=$BUILDPLATFORM oven/bun:1.0.3-slim AS frontendBuilder

ARG TARGETARCH

RUN mkdir /frontend && ls /frontend
COPY . /frontend
RUN bun install --cwd /frontend
RUN bun run --cwd /frontend build

# Use nginx base image
FROM nginx:alpine

RUN mkdir -p /userdata/extensions/cockpit/map

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
    "Binds":["/usr/blueos/userdata/extension/cockpit:/userdata/extensions/cockpit"],\
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

# Copy frontend built on frontendBuilder to nginx html directory
COPY --from=frontendBuilder /frontend/dist /usr/share/nginx/html

# Optionally, copy a custom nginx config if you have one
COPY ./nginx.conf /etc/nginx/nginx.conf

# Use the default command of nginx image which starts nginx in the foreground
# You don't need an ENTRYPOINT/CMD if you're using the base image's defaults
