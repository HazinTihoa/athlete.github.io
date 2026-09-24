"""Build the static anonymous entry from the same content used by Jekyll."""
from pathlib import Path
root = Path(__file__).resolve().parents[1]
layout = (root / "_layouts/project.html").read_text()
content = (root / "_includes/project-home.html").read_text()
assert layout.count("{{ content }}") == 1
(root / "index.html").write_text(layout.replace("{{ content }}", content))
print("Built index.html from the shared project layout and content.")
