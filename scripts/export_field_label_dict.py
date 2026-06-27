from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from pymongo import MongoClient


CONFIG_SPECS = [
    ("BasicInfoOption", "BasicinfoDict"),
    ("CabinetinfoOption", "CabinetinfoDict"),
    ("CabinetOption", "OptionDict"),
]


def normalize_dict(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    return {str(k): "" if v is None else str(v) for k, v in value.items()}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export merged FieldLabelDict from config dictionaries.",
    )
    parser.add_argument(
        "--mongo-uri",
        default="mongodb://root:example@localhost:27017/",
    )
    parser.add_argument("--database", default="hakodashi")
    parser.add_argument("--collection", default="config")
    parser.add_argument(
        "--output",
        default="docs/field-label-dict.json",
        help="Path for generated FieldLabelDict JSON.",
    )
    parser.add_argument(
        "--report",
        default="docs/field-label-dict-report.json",
        help="Path for merge report JSON.",
    )
    args = parser.parse_args()

    client = MongoClient(args.mongo_uri)
    collection = client[args.database][args.collection]

    merged: dict[str, str] = {}
    sources: dict[str, list[str]] = {}
    conflicts: list[dict[str, Any]] = []
    counts: dict[str, int] = {}

    for config_key, dict_key in CONFIG_SPECS:
        source_name = f"{config_key}.{dict_key}"
        doc = collection.find_one({"key": config_key}, {"_id": 0}) or {}
        data = doc.get("data") or {}
        current = normalize_dict(data.get(dict_key))
        counts[source_name] = len(current)

        for key, label in current.items():
            if key in merged and merged[key] != label:
                conflicts.append(
                    {
                        "key": key,
                        "existing": merged[key],
                        "incoming": label,
                        "existing_sources": sources[key],
                        "incoming_source": source_name,
                    },
                )
                continue

            merged[key] = label
            sources.setdefault(key, []).append(source_name)

    output = {"FieldLabelDict": dict(sorted(merged.items()))}
    report = {
        "source_counts": counts,
        "merged_count": len(merged),
        "conflict_count": len(conflicts),
        "conflicts": conflicts,
        "sources": {key: sources[key] for key in sorted(sources)},
    }

    output_path = Path(args.output)
    report_path = Path(args.report)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "output": str(output_path),
                "report": str(report_path),
                "merged_count": len(merged),
                "conflict_count": len(conflicts),
            },
            ensure_ascii=False,
        ),
    )


if __name__ == "__main__":
    main()
