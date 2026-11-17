FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc g++ libc6-dev python3 default-jdk-headless \
 && rm -rf /var/lib/apt/lists/*
COPY runner.py /runner.py
ENTRYPOINT ["python3", "/runner.py"]
