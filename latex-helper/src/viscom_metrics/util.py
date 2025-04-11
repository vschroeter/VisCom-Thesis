import json
import os

import pandas as pd


def get_metric_df_from_file(filepath: str) -> pd.DataFrame:
    # Read the json file to a dictionary
    # Inside the json file, there is a csvSummary key, which contains the csv file
    # Furthermore we need the data set information, e.g.:
    # "dataset": {
    #     "title": "MotorControlSystem",
    #     "description": "Metrics results for multiple visualizations",
    #     "timestamp": "2025-04-03T23-31-24",
    #     "nodeCount": 13,
    #     "connectionCount": 15,
    #     "visualizationCount": 13
    # },

    # Cols we want to have:
    # Visualization Name
    # Visualization Type
    # Data title
    # One col for each metric

    data = {}

    # os.path.join(data_dir, filename)
    with open(filepath, "r") as f:
        data = f.read()
        # Parse the json data
        data = json.loads(data)

    df_data = []

    for vis_key in data["visualizations"]:
        vis = data["visualizations"][vis_key]
        vis_data = dict()

        # Get the visualization name and type
        vis_data["name"] = vis["name"]
        vis_data["type"] = vis["type"]

        v_type: str = vis["type"]
        v_name: str = vis["name"]
        if v_type == "viscom":
            if "comm" in v_name.lower():
                vis_data["type"] = "viscomComm"
            elif "virtual" in v_name.lower():
                vis_data["type"] = "viscomVirtual"
            else:
                vis_data["type"] = "viscomDefault"

        # Get the metrics for this visualization
        for metric in vis["metrics"]:
            vis_data[metric] = vis["metrics"][metric]["value"]
            # vis_data["metric_type"] = vis["metrics"][metric]["definition"]["optimum"]

        df_data.append(vis_data)

    df = pd.DataFrame(df_data)

    # csv_summary = data.get("csvSummary")
    # if csv_summary is None:
    #     raise ValueError(f"csvSummary not found in {filename}")

    # # Pass csv_summary as buffer to pandas read_csv
    # csv_buffer = StringIO(csv_summary)
    # df = pd.read_csv(csv_buffer, sep=",")

    df["title"] = data["dataset"]["title"]
    df["nodes"] = data["dataset"]["nodeCount"]
    df["connections"] = data["dataset"]["connectionCount"]

    return df


def get_all_metrics_from_dir(dirpath: str) -> pd.DataFrame:
    concatenated_df: pd.DataFrame = None  # type: ignore
    # Get all files in the directory
    files = os.listdir(dirpath)

    for file_name in files:
        # Get the full path of the file
        file = os.path.join(dirpath, file_name)

        # Skip the file if it is a directory
        if os.path.isdir(file):
            continue

        # Check if the file is a json file
        if not file.endswith(".json"):
            continue

        df = get_metric_df_from_file(file)
        # print(f"File: {file}, Rows: {len(df)}")
        if concatenated_df is None:
            concatenated_df = df
        else:
            concatenated_df = pd.concat([concatenated_df, df], ignore_index=True)

    return concatenated_df


def split_camel_case(s: str, join=" ") -> str:
    """Splits a camel case string into words."""
    new_text = "".join([" " + i if i.isupper() else i for i in s]).split()
    new_text = join.join([t.capitalize() for t in new_text]).strip()
    return new_text
