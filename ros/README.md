# node_creator

## Overview

The `node_creator` Python script allows you to create dummy ROS nodes based on a dataset configuration. This is useful for visualizing system architectures live in ROS visualization tools such as `rqt_graph` or Foxglove.

## Usage

To start the node creator, run:

```bash
python ~/ros/node_creator/node_creator/creator.py <path.json>
```

- `<path.json>`: Path to a stored JSON dataset from [rosmetasys](https://github.com/vschroeter/rosmetasys).

The script will read the configuration from the JSON file and create dummy nodes accordingly.

## Example

```bash
python ~/ros/node_creator/node_creator/creator.py ~/ros/node_creator/data/0021nodes_2023-09-01_12_00_00_roseRobot.json
```

## Visualization

Once running, you can visualize the created nodes and their connections using tools like:

- `rqt_graph`
- [Foxglove Studio](https://foxglove.dev/)

This helps in understanding and presenting the system architecture.

