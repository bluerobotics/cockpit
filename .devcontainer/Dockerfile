# Same as production
ARG VARIANT=22.04
FROM ubuntu:${VARIANT}

ARG USERNAME=dev
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN apt-get update && apt-get install -y \
    curl \
    xvfb \
    git \
    nano \
    unzip \
    bash-completion \
    less \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create the user with the same UID/GID as host user
RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    && apt-get update \
    && apt-get install -y sudo \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# Set up NVM and Node.js
ENV NVM_DIR=/usr/local/nvm
ENV NODE_VERSION=v20.16.0
RUN mkdir -p /usr/local/nvm \
    && curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash \
    && . $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default \
    && chown -R $USERNAME:$USERNAME $NVM_DIR
ENV NODE_PATH=/usr/local/nvm/versions/node/$NODE_VERSION/bin
ENV PATH=$NODE_PATH:$PATH

# Set up Yarn
USER $USERNAME
WORKDIR /home/$USERNAME
RUN curl -fsSL https://classic.yarnpkg.com/install.sh | bash
ENV PATH=/home/$USERNAME/.yarn/bin:$PATH

# Set up bash
RUN echo 'export PS1="\[\e[01;32m\]\u\[\e[m\]:\[\e[01;34m\]\w\[\e[m\]\$ "' >> ~/.bashrc \
    && echo "export PATH=\"$BUN_PATH/bin:\$PATH\"" >> ~/.bashrc \
    && echo 'export NVM_DIR="/usr/local/nvm"' >> ~/.bashrc \
    && echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.bashrc

# Create workspace directory with correct permissions
USER root
RUN mkdir -p /workspace \
    && chown $USERNAME:$USERNAME /workspace

# Entrypoint script
COPY <<-"EOF" /usr/local/bin/entrypoint.sh
#!/bin/bash
if [ "$1" = "dev" ]; then
    # If first argument is "dev", start the dev server with host binding
    . ~/.bashrc && exec yarn dev --host 0.0.0.0
else
    # Otherwise, forward all arguments to yarn
    . ~/.bashrc && exec yarn "$@"
fi
EOF

RUN chmod +x /usr/local/bin/entrypoint.sh

USER $USERNAME
WORKDIR /workspace
ENV CONTAINER=true

# Verify installations
RUN . ~/.bashrc && yarn --version && node --version

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["dev"]
