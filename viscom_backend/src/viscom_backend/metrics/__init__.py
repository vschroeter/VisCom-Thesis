from __future__ import division, print_function

from .edge_crossing_metric import EdgeCrossingMetricCalculator as EdgeCrossingMetricCalculator

# from svgpathtools import Path, Line, QuadraticBezier, CubicBezier, Arc, parse_path
from .metrics_calculator import (
    MetricCalculator as MetricCalculator,
)
from .path_length_ratio_metric import (
    AbsolutePathLengthRatioMetricCalculator as AbsolutePathLengthRatioMetricCalculator,
)
from .path_length_ratio_metric import (
    NormalizedPathLengthRatioMetricCalculator as NormalizedPathLengthRatioMetricCalculator,
)

if __name__ == "__main__":
    l1 = Line(200 + 300j, 250 + 350j)
    l2 = Line(250 + 350j, 200 + 300j)

    p1 = "M 454.74939412490147 345.53595664135014 L 477.48987990020566 338.71464231112435"
    p2 = "M 477.48987990020566 338.71464231112435 L 454.74939412490147 345.53595664135014"

    path1 = parse_path(p1)
    path2 = parse_path(p2)

    print(path1.length())
    print(path2.length())

    i = path1.intersect(path2)
    print(len(i))
