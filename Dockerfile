# Dockerfile for SRVPro
FROM debian:buster as premake-builder

RUN apt update && \
    env DEBIAN_FRONTEND=noninteractive apt install -y wget build-essential p7zip-full && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /usr/src
RUN wget -O premake.zip https://github.com/premake/premake-core/releases/download/v5.0.0-alpha14/premake-5.0.0-alpha14-src.zip && \
    7z x -y premake.zip && \
    mv premake-5.0.0-alpha14 premake && \
    cd premake/build/gmake.unix && \
    make -j$(nproc)

FROM node:14-buster-slim

RUN npm install -g pm2

# apt
RUN apt update && \
    env DEBIAN_FRONTEND=noninteractive apt install -y wget git build-essential libevent-dev libsqlite3-dev mono-complete p7zip-full python3 liblua5.3-dev python && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# srvpro
COPY . /ygopro-server
WORKDIR /ygopro-server
RUN npm ci && \
    mkdir config decks replays logs

COPY --from=premake-builder /usr/src/premake/bin/release/premake5 /usr/bin/premake5

# ygopro
RUN git clone --branch=server --recursive --depth=1 https://github.com/moecube/ygopro && \
    cd ygopro && \
    git submodule foreach git checkout master && \
    premake5 gmake && \
    cd build && \
    make config=release -j$(nproc) && \
    cd .. && \
    mv ./bin/release/ygopro . && \
    strip ygopro && \
    mkdir replay expansions && \
    rm -rf .git* bin obj build ocgcore cmake lua premake* sound textures .travis.yml *.txt appveyor.yml LICENSE README.md *.lua strings.conf system.conf && \
    ls gframe | sed '/game.cpp/d' | xargs -I {} rm -rf gframe/{}

# windbot
RUN git clone --depth=1 https://github.com/moecube/windbot /tmp/windbot && \
    cd /tmp/windbot && \
    xbuild /property:Configuration=Release /property:TargetFrameworkVersion="v4.5" && \
    mv /tmp/windbot/bin/Release /ygopro-server/windbot && \
    cp -rf /ygopro-server/ygopro/cards.cdb /ygopro-server/windbot/ && \
    rm -rf /tmp/windbot

# infos
WORKDIR /ygopro-server
EXPOSE 7911 7922 7933
# VOLUME [ /ygopro-server/config, /ygopro-server/decks, /ygopro-server/replays, /redis ]

CMD [ "pm2-docker", "start", "/ygopro-server/data/pm2-docker.json" ]
