"""Profiling harness: warm-ups are not timed, one sample per image, RSS after load and at peak."""

from types import SimpleNamespace

import pytest

from benchmarks import profiling
from benchmarks.profiling import WARMUP_RUNS, current_rss_mb, profile

MIB = 1024 * 1024


class FakeClock:
    """perf_counter replacement: every call advances by the next planned duration pair."""

    def __init__(self, durations_s):
        self.calls = 0
        self._readings = []
        now = 0.0
        for duration in durations_s:
            self._readings += [now, now + duration]
            now += duration + 1.0

    def __call__(self):
        reading = self._readings[self.calls]
        self.calls += 1
        return reading


@pytest.fixture
def rss(monkeypatch):
    """Patch psutil so the process RSS is whatever `state['mb']` says."""
    state = {"mb": 100.0}

    class FakeProcess:
        def memory_info(self):
            return SimpleNamespace(rss=int(state["mb"] * MIB))

    monkeypatch.setattr(profiling.psutil, "Process", FakeProcess)
    return state


def test_current_rss_mb_converts_bytes_to_mb(rss):
    rss["mb"] = 256.0

    assert current_rss_mb() == pytest.approx(256.0)


def test_warmups_run_but_are_not_timed(rss, monkeypatch):
    clock = FakeClock([0.010, 0.020, 0.005])
    monkeypatch.setattr(profiling, "perf_counter", clock)
    calls = []

    result = profile(lambda: None, calls.append, ["a", "b", "c"])

    assert len(calls) == WARMUP_RUNS + 3
    assert clock.calls == 2 * 3  # a start and an end reading per timed image only
    assert len(result.latencies_ms) == 3


def test_one_latency_sample_per_image_in_milliseconds(rss, monkeypatch):
    monkeypatch.setattr(profiling, "perf_counter", FakeClock([0.010, 0.020, 0.005, 0.030]))

    result = profile(lambda: None, lambda item: None, [1, 2, 3, 4])

    assert result.latencies_ms == pytest.approx([10.0, 20.0, 5.0, 30.0])


def test_timed_calls_receive_every_image_in_order(rss):
    seen = []

    profile(lambda: None, seen.append, ["a", "b"])

    assert seen[WARMUP_RUNS:] == ["a", "b"]
    assert seen[:WARMUP_RUNS] == ["a", "b", "a", "b", "a"]  # warm-ups cycle through the inputs


def test_rss_is_read_after_load_and_before_any_inference(rss):
    def load():
        rss["mb"] = 400.0

    def run(item):
        rss["mb"] = 900.0

    result = profile(load, run, ["a"])

    assert result.rss_after_load_mb == pytest.approx(400.0)


def test_peak_rss_includes_warmup_spikes(rss):
    inferences = []

    def run(item):
        inferences.append(item)
        rss["mb"] = 700.0 if len(inferences) == 1 else 300.0  # only the first warm-up spikes

    result = profile(lambda: rss.update(mb=100.0), run, ["a", "b"])

    assert result.peak_rss_mb == pytest.approx(700.0)
    assert result.rss_after_load_mb == pytest.approx(100.0)


def test_peak_rss_follows_timed_calls_too(rss):
    sizes = {"a": 150.0, "b": 120.0, "c": 130.0, "d": 140.0, "e": 110.0, "f": 160.0, "g": 200.0}
    result = profile(lambda: None, lambda item: rss.update(mb=sizes[item]), list(sizes))

    # warm-ups only touch a-e (peak 150), so 200 MB can only come from the timed call on "g"
    assert result.peak_rss_mb == pytest.approx(200.0)


def test_empty_inputs_are_rejected(rss):
    with pytest.raises(ValueError, match="at least one input"):
        profile(lambda: None, lambda item: None, [])
