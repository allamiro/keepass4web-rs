FROM docker.io/rust:1-alpine as build

WORKDIR /workspace

COPY js js
COPY public public
COPY package*.json ./

RUN apk add --no-cache npm
RUN npm install
RUN cp node_modules/bootstrap/fonts/* public/fonts/
RUN npm run build

RUN apk add --no-cache build-base

# build dependencies in their own layer, so source changes don't recompile them
COPY Cargo.toml Cargo.lock ./
RUN mkdir src \
    && echo 'fn main() {}' > src/main.rs \
    && cargo build --release \
    && rm -rf src

COPY src src
RUN touch src/main.rs && cargo build --bins --release


FROM scratch

COPY --from=build /workspace/public /public
COPY --from=build /workspace/target/release/keepass4web-rs /keepass4web
COPY config.yml /conf/

EXPOSE 8080

VOLUME /conf

USER 1000:1000

ENV RUST_BACKTRACE=1

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD ["/keepass4web", "--config", "/conf/config.yml", "--health-check"]

CMD [ "/keepass4web", "--config", "/conf/config.yml"]
