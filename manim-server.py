#!/usr/bin/env python3
"""
Simple Manim render service.

Usage:
  pip install manim flask
  # Install ffmpeg, cairo, texlive, etc per Manim doc.
  python manim-server.py --port 8000

Endpoints:
  POST /render
    JSON: { "code": "<full python code for manim>", "scene": "SceneName", "format": "mp4" }
    Returns: { "success": true, "filename": "SceneName.mp4", "data": "<base64 file data>" }
"""
import argparse
import base64
import json
import os
import shutil
import subprocess
import tempfile
import time
from flask import Flask, request, jsonify, abort

app = Flask(__name__)

def run_manim(tmp_dir, pyfile_path, scene, quality_flag):
    # Manim CLI invocation
    # Example: manim -ql /path/to/file.py SceneName
    cmd = ["manim", quality_flag, pyfile_path, scene]
    proc = subprocess.run(cmd, cwd=tmp_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return proc

def find_latest_render(tmp_dir, module_name, scene, ext_whitelist):
    # Manim spits files into media directory in current working dir.
    media_dir = os.path.join(tmp_dir, "media")
    if not os.path.exists(media_dir):
        return None
    # Walk the tree to find files that match scene name and allowed extensions
    candidates = []
    for root, _, files in os.walk(media_dir):
        for f in files:
            if scene in f:
                path = os.path.join(root, f)
                if os.path.splitext(f)[1].lower().lstrip('.') in ext_whitelist:
                    mtime = os.path.getmtime(path)
                    candidates.append((mtime, path))
    if not candidates:
        return None
    # Return the newest file
    candidates.sort(reverse=True)
    return candidates[0][1]

@app.route("/render", methods=["POST"])
def render():
    payload = request.get_json(force=True)
    if not payload:
        return jsonify({"success": False, "error": "invalid json"}), 400

    code = payload.get("code")
    scene = payload.get("scene")
    out_format = payload.get("format", "mp4").lower()
    quality = payload.get("quality", "low")  # low -> -ql, medium -> -qm, high -> -qh

    if not code or not scene:
        return jsonify({"success": False, "error": "missing 'code' or 'scene'"}), 400

    quality_flag = "-ql"
    if quality == "low":
        quality_flag = "-ql"
    elif quality == "medium":
        quality_flag = "-qm"
    elif quality == "high":
        quality_flag = "-qh"

    # Allowed extensions we will search for (map format to ext set)
    format_map = {
        "mp4": {"mp4"},
        "gif": {"gif"},
        "png": {"png"},
        "svg": {"svg"},
    }
    if out_format not in format_map:
        return jsonify({"success": False, "error": f"unsupported format: {out_format}"}), 400

    tmp_dir = tempfile.mkdtemp(prefix="manim-server-")
    try:
        module_name = "manim_note"
        pyfile = os.path.join(tmp_dir, f"{module_name}.py")
        with open(pyfile, "w", encoding="utf8") as f:
            f.write(code)

        # Run manim
        proc = run_manim(tmp_dir, pyfile, scene, quality_flag)
        if proc.returncode != 0:
            return jsonify({
                "success": False,
                "error": "manim failed",
                "stdout": proc.stdout,
                "stderr": proc.stderr
            }), 500

        # Give manim a moment to flush files
        time.sleep(0.2)

        # Find render
        out_path = find_latest_render(tmp_dir, module_name, scene, format_map[out_format])
        if not out_path:
            # Try more broadly for allowed extension
            out_path = find_latest_render(tmp_dir, module_name, scene, set.union(*format_map.values()))
            if not out_path:
                return jsonify({"success": False, "error": "rendered file not found", "stdout": proc.stdout, "stderr": proc.stderr}), 500

        with open(out_path, "rb") as fh:
            bdata = fh.read()
        encoded = base64.b64encode(bdata).decode("ascii")
        filename = os.path.basename(out_path)
        return jsonify({"success": True, "filename": filename, "data": encoded}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        try:
            shutil.rmtree(tmp_dir)
        except Exception:
            pass

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    app.run(host=args.host, port=args.port)