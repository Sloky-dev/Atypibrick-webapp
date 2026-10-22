"""Raise only MOC upload limits on the existing Docker host vhost."""
from pathlib import Path
import shutil
import subprocess
import tempfile

LOCATION = "    location /api/atypibrick/v1/mocs {"


def configure(source):
    if LOCATION in source:
        block = source.split(LOCATION, 1)[1].split("\n    }", 1)[0]
        if "client_max_body_size 51m;" not in block:
            raise ValueError("Unexpected existing MOC location")
        return source
    start = source.index("    location /api/ {")
    end = source.index("\n    }", start) + len("\n    }")
    original = source[start:end]
    if "{" in original.split("{", 1)[1] or "proxy_pass http://atypibrick_backend;" not in original:
        raise ValueError("Unexpected API proxy configuration")
    moc = original.replace("    location /api/ {", LOCATION + "\n        client_max_body_size 51m;", 1)
    return source[:start] + moc + "\n\n" + source[start:]


def main():
    path = Path("/etc/nginx/sites-available/app.atypibrick.fr")
    source = path.read_text()
    if "server 127.0.0.1:18091;" not in source or "proxy_pass http://127.0.0.1:18083;" not in source:
        raise RuntimeError("Expected the current Docker API and frontend routing")
    updated = configure(source)
    if updated == source:
        print("MOC upload limit already configured")
        return
    record = Path(tempfile.mkdtemp(prefix="moc-upload-limit-", dir="/var/backups/atypik-migration"))
    backup = record / "vhost.original"
    shutil.copy2(path, backup)
    try:
        path.write_text(updated)
        subprocess.run(["nginx", "-t"], check=True)
        subprocess.run(["systemctl", "reload", "nginx"], check=True)
    except BaseException:
        shutil.copy2(backup, path)
        subprocess.run(["nginx", "-t"], check=True)
        subprocess.run(["systemctl", "reload", "nginx"], check=True)
        raise
    print(f"MOC requests: 51 MiB; application PDF limit: 50 MiB. Backup: {backup}")


if __name__ == "__main__":
    main()
