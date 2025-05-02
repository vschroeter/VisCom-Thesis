import os
import subprocess
import tempfile
from typing import Optional

from flask import jsonify, request


def get_graphviz_path() -> str:
    """
    Get the path or name of the GraphViz executable.
    Uses the GRAPHVIZ_DOT_PATH environment variable if set, otherwise defaults to 'dot'.
    """
    return os.environ.get("GRAPHVIZ_DOT_PATH", "C:\\Users\\schoc\\Documents\\Studium\\HPI\\Master Thesis\\graphviz\\Graphviz-12.2.1-win64\\bin\\dot.exe")


def render_dot_to_svg(dot_string: str, layout_engine: str = "dot") -> Optional[str]:
    """
    Renders a DOT string to SVG using the GraphViz command-line tool.

    Args:
        dot_string: The DOT language string to render
        layout_engine: The layout engine to use (dot, neato, fdp, etc.)

    Returns:
        SVG string or None if rendering failed
    """
    graphviz_path = get_graphviz_path()

    # if not os.path.exists(graphviz_path):
    #     raise FileNotFoundError(f"GraphViz executable not found at: {graphviz_path}")

    # Create temporary files for input and output
    with tempfile.NamedTemporaryFile(mode="w", suffix=".dot", delete=False) as dot_file:
        dot_file.write(dot_string)
        dot_file_path = dot_file.name

    svg_file_path = dot_file_path + ".svg"

    try:
        # Call GraphViz to generate SVG
        cmd = [graphviz_path, f"-K{layout_engine}", "-Tsvg", dot_file_path, "-o", svg_file_path]
        process = subprocess.run(cmd, check=True, capture_output=True, text=True)

        # Read the generated SVG file
        with open(svg_file_path, "r") as svg_file:
            svg_content = svg_file.read()

        return svg_content

    except subprocess.CalledProcessError as e:
        print(f"Error rendering DOT: {e.stderr}")
        return None

    finally:
        # Clean up temporary files
        if os.path.exists(dot_file_path):
            os.remove(dot_file_path)
        if os.path.exists(svg_file_path):
            os.remove(svg_file_path)


def register_routes(app):
    """Register the GraphViz API routes with the Flask app."""

    @app.route("/render/graphViz", methods=["POST"])
    def render_graphviz():
        """Endpoint to render a DOT string using GraphViz and return SVG."""
        try:
            data = request.get_json()

            if not data or "dot" not in data:
                return jsonify({"error": "Missing DOT string in request"}), 400

            dot_string = data["dot"]
            layout_engine = data.get("engine", "dot")

            # Validate layout engine
            valid_engines = ["dot", "circo", "fdp", "neato", "twopi", "sfdp", "osage", "patchwork"]
            if layout_engine not in valid_engines:
                return jsonify({"error": f"Invalid layout engine. Must be one of {', '.join(valid_engines)}"}), 400

            # Render DOT to SVG
            svg_content = render_dot_to_svg(dot_string, layout_engine)

            if svg_content is None:
                return jsonify({"error": "Failed to render DOT string"}), 500

            return jsonify({"svg": svg_content})

        except Exception as e:
            return jsonify({"error": f"Error rendering graph: {str(e)}"}), 500
