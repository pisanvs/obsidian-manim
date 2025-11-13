# Manim visualizer for Obsidian (integration instructions)

This adds a Manim-backed visualizer to Obsidian. It works by sending Manim code blocks from notes to a small local rendering service that runs the Manim CLI and returns the rendered asset.

1) Install Manim and requirements
   - Follow Manim Community installation docs: https://docs.manim.community/
   - Ensure you have Python 3.8+, ffmpeg, cairo and (optionally) LaTeX installed.

2) Install Python dependencies for the local server
   - pip install flask manim

3) Run the server
   - python manim-server.py --port 8000
   - The server listens on localhost by default.

4) Usage in notes
   - Create a code fence labelled `manim` with optional info flags:
     ```manim scene=MyScene format=mp4 quality=medium
     from manim import *
     class MyScene(Scene):
         def construct(self):
             self.play(Write(Text("Hello Manim")))
     ```
   - When the note is previewed, the plugin will send the code to the server and display the returned video/image inline.

5) Plugin configuration
   - Configure the server URL (default http://localhost:8000), default format (mp4), and quality via plugin settings (if you add UI).

Security note:
- The server executes given Python code with Manim. Only render code from trustable notes. Don't expose the server to networks beyond localhost.

Troubleshooting:
- If render fails, check manim-server.py logs and the manim CLI output (the server returns stdout/stderr on failure).
- Ensure ffmpeg and other native deps are installed.
