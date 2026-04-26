FROM rust:1.77-alpine AS builder

WORKDIR /usr/src/app
COPY . .

# Install build dependencies for Alpine (musl, openssl, pkgconfig)
RUN apk add --no-cache musl-dev openssl-dev pkgconfig && \
    cargo build --release

FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache ca-certificates openssl libgcc

COPY --from=builder /usr/src/app/target/release/rust-worker /usr/local/bin/rust-worker

CMD ["rust-worker"]
