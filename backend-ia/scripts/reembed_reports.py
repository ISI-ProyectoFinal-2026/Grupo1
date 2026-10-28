"""Regenerate the embedding (and matches) of every report that has an image.

Needed after changing the embedding model: vectors from different models live
in different spaces and cannot be compared or converted. Run from backend-ia/:

    python -m scripts.reembed_reports            # published reports only
    python -m scripts.reembed_reports --all      # every report with an image

Runs in two passes: regenerate every embedding, then recompute matches once
all vectors come from the same model. A pending match whose new score falls
below MATCH_THRESHOLD is not removed (the upsert skips it): delete stale
pending matches before running this after a model change.
"""

import argparse
import asyncio
import logging

from sqlalchemy import text

from app.db import async_session_factory, engine
from app.services.embedding_service import process_report_image
from app.services.matching_service import find_and_store_matches

logger = logging.getLogger("reembed_reports")


async def main(include_all: bool) -> None:
    async with async_session_factory() as session:
        result = await session.execute(
            text(
                f"""
                SELECT id, image_url FROM reports
                WHERE image_url IS NOT NULL
                {"" if include_all else "AND status = 'published'"}
                ORDER BY created_at, id
                """
            )
        )
        reports = result.all()

    print(f"re-embedding {len(reports)} reports")
    embedded = []
    for report_id, image_url in reports:
        try:
            async with async_session_factory() as session:
                saved = await process_report_image(report_id, image_url, session)
            print(f"  report {report_id}: {'ok' if saved else 'no animal detected'}")
            if saved:
                embedded.append(report_id)
        except Exception as exc:  # noqa: BLE001 - one broken image must not stop the batch
            print(f"  report {report_id}: FAILED ({exc})")

    # process_report_image already matched each report, but against a mix of
    # new and not-yet-regenerated embeddings. A second pass, once every vector
    # comes from the same model, leaves the scores consistent.
    print(f"re-matching {len(embedded)} reports")
    for report_id in embedded:
        async with async_session_factory() as session:
            count = await find_and_store_matches(report_id, session)
        if count:
            print(f"  report {report_id}: {count} matches")

    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--all", action="store_true", help="include non-published reports")
    asyncio.run(main(parser.parse_args().all))
