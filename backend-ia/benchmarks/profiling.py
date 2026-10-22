"""Latency and memory profiling for one model adapter.

Latency is one `perf_counter` sample per image after `WARMUP_RUNS` untimed
runs. RSS is read right after loading and after every call (warm-ups
included), so the peak catches first-call allocations. "MB" means MiB.
"""

from dataclasses import dataclass
from time import perf_counter
from typing import Any, Callable, Sequence

import psutil

WARMUP_RUNS = 5
BYTES_PER_MB = 1024 * 1024
MS_PER_SECOND = 1000.0


@dataclass(frozen=True)
class ProfileResult:
    latencies_ms: list[float]
    rss_after_load_mb: float
    peak_rss_mb: float


def current_rss_mb() -> float:
    return psutil.Process().memory_info().rss / BYTES_PER_MB


def profile(load: Callable[[], Any], run: Callable[[Any], Any], inputs: Sequence) -> ProfileResult:
    """Call `load()` once, warm up `run`, then time `run(item)` for every input."""
    if len(inputs) == 0:
        raise ValueError("profile needs at least one input")

    load()
    rss_after_load = current_rss_mb()
    peak = rss_after_load

    for index in range(WARMUP_RUNS):
        run(inputs[index % len(inputs)])
        peak = max(peak, current_rss_mb())

    latencies_ms = []
    for item in inputs:
        start = perf_counter()
        run(item)
        latencies_ms.append((perf_counter() - start) * MS_PER_SECOND)
        peak = max(peak, current_rss_mb())

    return ProfileResult(latencies_ms, rss_after_load, peak)
