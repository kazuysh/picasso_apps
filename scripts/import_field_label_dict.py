from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from pymongo import MongoClient


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import FieldLabelDict JSON into MongoDB config collection.",
    )
    parser.add_argument(
        "--mongo-uri",
        default="mongodb://root:example@localhost:27017/",
    )
    parser.add_argument("--database", default="hakodashi")
    parser.add_argument("--collection", default="config")
    parser.add_argument("--key", default="field-label-dict")
    parser.add_argument("--input", default="docs/field-label-dict.json")
    args = parser.parse_args()

    input_path = Path(args.input)
    payload: dict[str, Any] = json.loads(input_path.read_text(encoding="utf-8"))

    client = MongoClient(args.mongo_uri)
    collection = client[args.database][args.collection]

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    result = collection.update_one(
        {"key": args.key},
        {
            "$set": {
                "key": args.key,
                "data": payload,
                "updated_at": now,
            },
        },
        upsert=True,
    )

    print(
        json.dumps(
            {
                "key": args.key,
                "matched_count": result.matched_count,
                "modified_count": result.modified_count,
                "upserted_id": str(result.upserted_id)
                if result.upserted_id is not None
                else None,
                "field_count": len(payload.get("FieldLabelDict", {})),
            },
            ensure_ascii=False,
        ),
    )


if __name__ == "__main__":
    main()
