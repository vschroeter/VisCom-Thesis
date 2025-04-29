# VisCom Master Thesis

## Introduction

This repository contains the code and resources for the Master Thesis "**VisCom: Scalable Visualization of Communication Networks by the Example of Robot Operating System 2 Networks**".
The project focuses on the visualization, analysis, and evaluation of communication graphs, especially in the context of robotic systems and ROS (Robot Operating System). It provides:

- A web-based evaluation playground for visualizing and comparing graph layouts and metrics.
- A Python backend for graph processing, metrics calculation, and dataset management.
- Helper scripts for LaTeX-based reporting and data analysis.
- Docker-based deployment for easy setup and reproducibility.

## Directory Overview

| Directory / File                                  | Description                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [evaluation-playground/](./evaluation-playground) | Quasar/Vue3 frontend for interactive graph visualization and evaluation.           |
| [viscom_backend/](./viscom_backend)               | Python backend (Flask) for graph processing, metrics, and API endpoints.           |
| [ros/node_creator/](./ros/node_creator)           | Python script for generating and simulating ROS node graphs from stored JSON data.  |
| [latex-helper/](./latex-helper)                   | Jupyter notebooks and scripts for LaTeX table/report generation and data analysis. |
| [docker-compose.yml](./docker-compose.yml)        | Top-level Docker Compose file to orchestrate frontend and backend services.        |

## Quickstart

### Using Docker (Recommended)

1. **Build and start all services:**
   ```bash
   docker compose up --build
   ```
   This will start:
   - The frontend at [http://localhost:9000](http://localhost:9000)
   - The backend API at [http://localhost:5000](http://localhost:5000)

2. **Stop all services:**
   ```bash
   docker compose down
   ```

### Running From Source

#### Backend (Python)

1. Install Python 3.12+ and [uv](https://github.com/astral-sh/uv).
2. Install dependencies:
   ```bash
   cd viscom_backend
   uv sync
   ```
3. Start the backend:
   ```bash
   uv run src/viscom_backend/main.py
   ```

#### Frontend (Quasar/Vue)

1. Install [Node.js](https://nodejs.org/) (v20+) and [pnpm](https://pnpm.io/).
2. Install dependencies:
   ```bash
   cd evaluation-playground
   pnpm install
   ```
3. Start the frontend:
   ```bash
   pnpm dev
   ```
   The app will be available at [http://localhost:9000](http://localhost:9000).

#### ROS Node Creator

- See `ros/node_creator/README.md` or the scripts for details on simulating ROS nodes.

#### LaTeX Helper

- Open and run the Jupyter notebooks in `latex-helper/` for data analysis and LaTeX export.

---

For more details, see the documentation in each subdirectory or the code comments.
