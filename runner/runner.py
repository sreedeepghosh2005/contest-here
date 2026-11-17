"""Runs inside the sandbox container.

Reads one JSON job on stdin: {language, time_limit_ms, code, inputs: [..]}.
Writes the test inputs to /in (root only). Writes the code to /box.
Compiles once, runs the program once per input, prints one JSON object on stdout.

This script runs as root. The compiler and the submitted program run as
uid 65534 (nobody), so the submitted program cannot write to this script's
stdout or change its result.
"""
import json
import os
import resource
import subprocess
import sys
import time

BOX = "/box"
UID = GID = 65534
OUT_CAP = 256 * 1024
ERR_CAP = 4 * 1024
COMPILE_TIMEOUT = 30

SOURCE = {"c": "main.c", "cpp": "main.cpp", "java": "Main.java", "python": "main.py"}
COMPILE = {
    "c": ["gcc", "-O2", "-std=c17", "-o", "main", "main.c", "-lm"],
    "cpp": ["g++", "-O2", "-std=c++20", "-o", "main", "main.cpp"],
    "java": ["javac", "-J-Xmx256m", "-d", ".", "Main.java"],
    "python": ["python3", "-m", "py_compile", "main.py"],
}
RUN = {
    "c": ["./main"],
    "cpp": ["./main"],
    "java": ["java", "-Xmx256m", "-Xss64m", "-XX:+UseSerialGC", "-cp", ".", "Main"],
    "python": ["python3", "main.py"],
}
ENV = {
    "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "HOME": BOX,
    "LANG": "C.UTF-8",
}


def limits():
    size = 32 * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_FSIZE, (size, size))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


def as_nobody(**kw):
    return dict(cwd=BOX, env=ENV, user=UID, group=GID, extra_groups=[],
                start_new_session=True, preexec_fn=limits, **kw)


def sweep():
    """Kill every process that still runs as nobody.

    This does not fork, so it works during a fork bomb. The runner sets its real
    and effective uid to nobody (saved uid stays 0), sends SIGKILL to every
    process it may signal, then switches back to root.
    kill(-1) skips pid 1, which is this runner.
    """
    os.setresuid(UID, UID, 0)
    try:
        for _ in range(50):
            try:
                os.kill(-1, 9)
            except ProcessLookupError:
                break
            time.sleep(0.01)
    finally:
        os.setresuid(0, 0, 0)


def read_cap(path, cap):
    with open(path, "rb") as f:
        return f.read(cap).decode("utf-8", "replace")


def main():
    job = json.load(sys.stdin)
    lang = job["language"]
    time_limit = job["time_limit_ms"] / 1000.0
    result = {"compile": {"ok": True, "output": ""}, "tests": []}

    with open(os.path.join(BOX, SOURCE[lang]), "w") as f:
        f.write(job["code"])
    os.makedirs("/in/tests", exist_ok=True)
    for i, text in enumerate(job["inputs"]):
        with open("/in/tests/%d.in" % i, "w") as f:
            f.write(text)

    log = os.path.join(BOX, ".compile.log")
    with open(log, "wb") as out:
        p = subprocess.Popen(COMPILE[lang], **as_nobody(
            stdin=subprocess.DEVNULL, stdout=out, stderr=subprocess.STDOUT))
        try:
            rc = p.wait(timeout=COMPILE_TIMEOUT)
        except subprocess.TimeoutExpired:
            rc = -1
        sweep()
        p.wait()
    if rc != 0:
        output = read_cap(log, 16 * 1024)
        if rc == -1:
            output += "\nCompile step took too long."
        result["compile"] = {"ok": False, "output": output}
        print(json.dumps(result))
        return

    for i in range(len(job["inputs"])):
        out_path = os.path.join(BOX, ".out")
        err_path = os.path.join(BOX, ".err")
        with open("/in/tests/%d.in" % i, "rb") as fin, \
                open(out_path, "wb") as fout, open(err_path, "wb") as ferr:
            start = time.monotonic()
            p = subprocess.Popen(RUN[lang], **as_nobody(stdin=fin, stdout=fout, stderr=ferr))
            try:
                rc = p.wait(timeout=time_limit)
                status = "ok" if rc == 0 else "rte"
            except subprocess.TimeoutExpired:
                status = "tle"
            elapsed = int((time.monotonic() - start) * 1000)
            sweep()
            p.wait()
        result["tests"].append({
            "status": status,
            "time_ms": elapsed,
            "stdout": read_cap(out_path, OUT_CAP),
            "stderr": read_cap(err_path, ERR_CAP),
        })

    print(json.dumps(result))


main()
