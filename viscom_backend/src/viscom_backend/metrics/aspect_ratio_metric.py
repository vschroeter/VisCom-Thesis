from __future__ import annotations

from .metrics_calculator import MetricCalculator, MetricResult


class AspectRatioMetricCalculator(MetricCalculator):
    """
    Calculator for measuring the aspect ratio of a graph layout.

    A good layout should have a balanced aspect ratio, being neither too wide nor too tall,
    which makes it easier to display and understand.
    """

    API_METHOD_NAME = "aspectRatio"

    def calculate(self) -> MetricResult:
        """
        Calculate the aspect ratio of the layout's bounding box.

        The aspect ratio is defined as min(w/h, h/w) to ensure a value between [0, 1].
        Values closer to 1 indicate a more balanced aspect ratio (closer to square),
        while values closer to 0 indicate a layout that is either too wide or too tall.

        Returns:
            MetricResult: The aspect ratio metric result.
        """
        if not self.nodes:
            return MetricResult(key=self.API_METHOD_NAME, value=0.0, type="higher-better", error="No nodes found")

        # Find the bounding box of the layout
        min_x = min((node.x - node.radius) for node in self.nodes)
        max_x = max((node.x + node.radius) for node in self.nodes)
        min_y = min((node.y - node.radius) for node in self.nodes)
        max_y = max((node.y + node.radius) for node in self.nodes)

        # Find the bounding box of the connections
        for link in self.valid_links:
            if link.path is not None:
                bbox = link.path.bbox()
                min_x = min(min_x, bbox[0])
                max_x = max(max_x, bbox[1])
                min_y = min(min_y, bbox[2])
                max_y = max(max_y, bbox[3])

        # Calculate width and height
        width = max_x - min_x
        height = max_y - min_y

        # Handle edge cases
        if width <= 0 or height <= 0:
            return MetricResult(key=self.API_METHOD_NAME, value=0.0, type="higher-better", error="Invalid layout dimensions")

        # Calculate aspect ratio as min(w/h, h/w) to ensure result is between 0 and 1
        aspect_ratio = min(width / height, height / width)

        print(f"\tLayout width: {width}")
        print(f"\tLayout height: {height}")
        print(f"\tAspect ratio: {aspect_ratio}")

        return MetricResult(
            key=self.API_METHOD_NAME,
            value=aspect_ratio,
            type="higher-better",  # Higher values (closer to 1) indicate more balanced aspect ratios
        )
