# Build frontend
FROM --platform=$BUILDPLATFORM node:16-buster-slim AS frontendBuilder

RUN mkdir /frontend && ls /frontend
COPY . /frontend
RUN --mount=type=cache,target=/frontend/node_modules yarn --cwd /frontend install --network-timeout=300000
RUN --mount=type=cache,target=/frontend/node_modules yarn --cwd /frontend build

FROM alpine:3.14

# Install simple http server
RUN apk add --no-cache wget
RUN wget https://github.com/TheWaWaR/simple-http-server/releases/download/v0.6.6/armv7-unknown-linux-musleabihf-simple-http-server \
    -O /usr/bin/simple-http-server
RUN chmod +x /usr/bin/simple-http-server

LABEL permissions '{\
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

# Copy frontend built on frontendBuild to this stage
COPY --from=frontendBuilder /frontend/dist /cockpit
ENTRYPOINT ["simple-http-server", "--index", "cockpit"]