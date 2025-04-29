import logging
import multiprocessing
import os
import signal
import sys
import threading
import time
import traceback
import uuid
from typing import Any, Dict, List, Optional

from .metrics_calculator import calculate_all_metrics, calculate_metrics, convert_dict_to_laid_out_data

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Job status constants
JOB_STATUS_PENDING = "pending"
JOB_STATUS_PROCESSING = "processing"
JOB_STATUS_COMPLETED = "completed"
JOB_STATUS_FAILED = "failed"

# Process timeout in seconds
PROCESS_TIMEOUT = 120


class JobInfo:
    """Information about a metrics calculation job."""

    def __init__(self, job_id: str, method: Optional[str] = None):
        self.job_id: str = job_id
        self.method: Optional[str] = method
        self.status: str = JOB_STATUS_PENDING
        self.results: List[Dict[str, Any]] = []
        self.error: Optional[str] = None
        self.created_at: float = time.time()
        self.started_at: Optional[float] = None
        self.completed_at: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert job info to a dictionary."""
        return {
            "job_id": self.job_id,
            "method": self.method,
            "status": self.status,
            "results": self.results,
            "error": self.error,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "execution_time": (self.completed_at - self.started_at) if self.completed_at and self.started_at else None,
        }


def _calculate_metrics_process(data_dict: Dict[str, Any], method: Optional[str], result_dict: Dict[str, Any], job_id: str, pid_dict: Dict[str, int]) -> None:
    """Worker function to calculate metrics in a separate process."""
    try:
        job_result_dict = result_dict[job_id]

        # Record PID for potential termination
        pid_dict["pid"] = os.getpid()

        logger.info(f"Process {os.getpid()} started for method {method}")

        # Set up signal handler for graceful termination
        def handler(signum, frame):
            logger.info(f"Process {os.getpid()} received signal {signum}, shutting down")
            job_result_dict["status"] = JOB_STATUS_FAILED
            job_result_dict["error"] = "Job was terminated"
            sys.exit(1)

        signal.signal(signal.SIGTERM, handler)

        # Mark as processing
        job_result_dict["status"] = JOB_STATUS_PROCESSING
        job_result_dict["started_at"] = time.time()

        # Convert data and calculate metrics
        laid_out_data = convert_dict_to_laid_out_data(data_dict)

        if method:
            # Calculate single metric
            metric_result = calculate_metrics(laid_out_data, method)
            metrics_results = [metric_result]
            logger.info(f"Process {os.getpid()}: Calculated metric for method {method}: {metric_result}")
        else:
            # Calculate all metrics
            metrics_results = calculate_all_metrics(laid_out_data)
            logger.info(f"Process {os.getpid()}: Calculated all metrics")

        # Store results - Convert MetricResult objects to dictionaries
        # and make sure to explicitly update the shared dictionary
        metric_dicts = [{"key": metric.key, "value": metric.value, "type": metric.type, "error": metric.error} for metric in metrics_results]

        # Must update the shared dictionary explicitly
        job_result_dict["results"] = metric_dicts
        job_result_dict["status"] = JOB_STATUS_COMPLETED
        job_result_dict["completed_at"] = time.time()

        result_dict[job_id] = job_result_dict
        # Make sure changes are flushed before exiting
        logger.info(f"Process {os.getpid()} completed successfully with status: {job_result_dict['status']}")

    except Exception as e:
        logger.error(f"Error in metrics calculation process {os.getpid()}: {str(e)}")
        logger.error(traceback.format_exc())

        # Must update the shared dictionary explicitly
        job_result_dict["status"] = JOB_STATUS_FAILED
        job_result_dict["error"] = f"{str(e)}\n{traceback.format_exc()}"
        job_result_dict["completed_at"] = time.time()

    result_dict[job_id] = job_result_dict
    # Sleep briefly to ensure updates are synchronized
    time.sleep(0.1)


class MetricsProcessor:
    """Manager for processing metrics calculations in separate processes."""

    # Class-level lock for singleton protection
    _instance_lock = threading.Lock()
    _instance = None

    @classmethod
    def get_instance(cls) -> "MetricsProcessor":
        """Thread-safe singleton getter."""
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    logger.info("Creating MetricsProcessor instance")
                    cls._instance = cls()
        return cls._instance

    def __init__(self):
        # Prevent direct instantiation outside of get_instance
        if MetricsProcessor._instance is not None:
            logger.warning("Attempted to create a second MetricsProcessor instance!")
            raise RuntimeError("Use MetricsProcessor.get_instance() to get the processor")

        # Set the start method for multiprocessing
        try:
            if sys.platform.startswith("win"):
                multiprocessing.set_start_method("spawn", force=True)
            else:
                multiprocessing.set_start_method("fork", force=True)
        except RuntimeError:
            # Method already set, ignore
            pass

        # Use a manager for shared state between processes
        self.manager = multiprocessing.Manager()
        self.jobs: Dict[str, JobInfo] = {}
        self.results: Dict[str, Dict[str, Any]] = self.manager.dict()
        self.pids: Dict[str, int] = self.manager.dict()
        self.processes: Dict[str, multiprocessing.Process] = {}
        self.job_cleanup_threshold_sec = 120  # Clean up jobs after 60 seconds
        logger.info(f"Initialized MetricsProcessor with multiprocessing start method: {multiprocessing.get_start_method()}")

    def submit_job(self, data_dict: Dict[str, Any], method: Optional[str] = None) -> str:
        """
        Submit a metrics calculation job to be processed asynchronously.

        Args:
            data_dict: Layout data dictionary
            method: Optional specific metric method to calculate

        Returns:
            Job ID that can be used to check status and retrieve results
        """
        # Generate unique job ID
        job_id = str(uuid.uuid4())

        # Create job info
        job_info = JobInfo(job_id=job_id, method=method)
        self.jobs[job_id] = job_info

        # Set up shared result dictionary
        self.results[job_id] = {"status": JOB_STATUS_PENDING, "results": [], "error": None, "started_at": None, "completed_at": None}

        # Start process
        process = multiprocessing.Process(target=_calculate_metrics_process, args=(data_dict, method, self.results, job_id, self.pids))
        process.daemon = True  # Allow the process to be terminated when the main process exits
        process.start()

        self.processes[job_id] = process
        logger.info(f"Started metrics calculation job {job_id}")

        # Schedule cleanup of old jobs
        self._cleanup_old_jobs()

        return job_id

    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the status and results (if available) for a job.

        Args:
            job_id: The ID of the job to check

        Returns:
            Job status information or None if job not found
        """
        # Check if job exists
        if job_id not in self.jobs:
            logger.debug(f"Job {job_id} not found in job registry")
            return None

        job_info = self.jobs[job_id]

        # Log the current state for debugging
        logger.debug(f"Job {job_id} current state: status={job_info.status}")

        # Update job info from shared results dictionary
        if job_id in self.results:
            result_dict = dict(self.results[job_id])  # Create a local copy to avoid race conditions

            # Log the values from shared dictionary
            logger.debug(f"Job {job_id} shared dict state: status={result_dict.get('status')}, has_results={len(result_dict.get('results', []))}")

            # Update job info from result dictionary
            job_info.status = result_dict.get("status", job_info.status)
            job_info.error = result_dict.get("error", job_info.error)
            job_info.started_at = result_dict.get("started_at", job_info.started_at)
            job_info.completed_at = result_dict.get("completed_at", job_info.completed_at)

            # Update results if available
            if "results" in result_dict and result_dict["results"]:
                job_info.results = result_dict["results"]

        # Check if process is still running
        process_alive = False
        if job_id in self.processes:
            process_alive = self.processes[job_id].is_alive()

            # Only consider a terminated process unexpected if it didn't update its status
            if not process_alive and job_info.status in (JOB_STATUS_PENDING, JOB_STATUS_PROCESSING):
                logger.warning(f"Process for job {job_id} terminated unexpectedly with status {job_info.status}")
                job_info.status = JOB_STATUS_FAILED
                job_info.error = "Process terminated unexpectedly" + (f" (PID: {self.pids[job_id]})" if job_id in self.pids else "")

            # Clean up the process if it's no longer alive
            if not process_alive:
                self.processes[job_id].join(0.1)
                del self.processes[job_id]

        logger.debug(f"Job {job_id} process_alive={process_alive}, final status={job_info.status}")

        # Handle timeout
        if job_info.status == JOB_STATUS_PROCESSING and job_info.started_at and time.time() - job_info.started_at > PROCESS_TIMEOUT:
            # Terminate the process if it's still running
            if job_id in self.processes and self.processes[job_id].is_alive():
                try:
                    logger.warning(f"Terminating job {job_id} due to timeout")
                    if job_id in self.pids:
                        # Try to terminate gracefully first using the process's own PID
                        os.kill(self.pids[job_id], signal.SIGTERM)
                    self.processes[job_id].join(2.0)  # Give it 2 seconds to clean up
                    if self.processes[job_id].is_alive():
                        self.processes[job_id].terminate()
                except Exception as e:
                    logger.error(f"Error terminating process: {e}")

            job_info.status = JOB_STATUS_FAILED
            job_info.error = "Job timed out after {PROCESS_TIMEOUT} seconds"

        return job_info.to_dict()

    def _cleanup_old_jobs(self):
        """Clean up old jobs to prevent memory leaks."""
        current_time = time.time()
        jobs_to_remove = []

        for job_id, job_info in self.jobs.items():
            # Remove old completed or failed jobs
            if job_info.status in (JOB_STATUS_COMPLETED, JOB_STATUS_FAILED) and current_time - job_info.created_at > self.job_cleanup_threshold_sec:
                jobs_to_remove.append(job_id)

        for job_id in jobs_to_remove:
            if job_id in self.processes:
                if self.processes[job_id].is_alive():
                    self.processes[job_id].terminate()
                self.processes[job_id].join(0.1)
                del self.processes[job_id]

            if job_id in self.results:
                del self.results[job_id]

            if job_id in self.pids:
                del self.pids[job_id]

            del self.jobs[job_id]

            logger.info(f"Cleaned up old job {job_id}")

    def shutdown(self):
        """Shutdown the processor and terminate all running processes."""
        for job_id, process in self.processes.items():
            if process.is_alive():
                logger.info(f"Terminating process for job {job_id}")
                try:
                    process.terminate()
                    process.join(0.5)
                except:
                    pass

        # Clean up manager
        self.manager.shutdown()
        logger.info("Metrics processor shut down")


# Thread-safe singleton getter function
def get_metrics_processor() -> MetricsProcessor:
    """Get the metrics processor singleton instance in a thread-safe way."""
    return MetricsProcessor.get_instance()


# Protection for Windows multiprocessing
if __name__ == "__main__":
    # This would only be executed if this file is run directly
    multiprocessing.freeze_support()
