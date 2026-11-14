#!/usr/bin/env python3
"""Fabrique news.json à partir des flux RSS publics du Monde et de franceinfo.

Lancé chaque matin par la tâche planifiée GitHub (.github/workflows/news.yml).
L'app lit ensuite news.json : aucun service payant, aucune clé.
Pour changer les rubriques ou les sources, modifie la liste SECTIONS.
"""
import html
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

SECTIONS = [
    ("une", "À la une", [("Le Monde", "https://www.lemonde.fr/rss/une.xml"), ("franceinfo", "https://www.francetvinfo.fr/titres.rss")]),
    ("eco", "Économie", [("Le Monde", "https://www.lemonde.fr/economie/rss_full.xml"), ("franceinfo", "https://www.francetvinfo.fr/economie.rss")]),
    ("monde", "Monde", [("Le Monde", "https://www.lemonde.fr/international/rss_full.xml"), ("franceinfo", "https://www.francetvinfo.fr/monde.rss")]),
    ("sport", "Sport", [("franceinfo", "https://www.francetvinfo.fr/sports.rss")]),
]
PAR_SOURCE = 6   # nombre de titres gardés par source et par rubrique


def clean(text, limit):
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = re.sub(r"\s+", " ", html.unescape(text)).strip()
    if len(text) > limit:
        text = text[:limit].rsplit(" ", 1)[0] + "…"
    return text


def read_feed(source, url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (lecteur RSS)"})
    with urllib.request.urlopen(req, timeout=20) as res:
        root = ET.fromstring(res.read())
    items = []
    for it in root.iter("item"):
        title = clean(it.findtext("title"), 200)
        link = (it.findtext("link") or "").strip()
        if not title or not link.startswith("http"):
            continue
        date = ""
        try:
            date = parsedate_to_datetime(it.findtext("pubDate")).astimezone(timezone.utc).isoformat()
        except Exception:
            pass
        items.append({"title": title, "desc": clean(it.findtext("description"), 220), "link": link, "source": source, "date": date})
        if len(items) >= PAR_SOURCE:
            break
    return items


def main():
    sections, seen = [], set()
    for sid, title, feeds in SECTIONS:
        items = []
        for source, url in feeds:
            try:
                for it in read_feed(source, url):
                    key = it["link"]
                    if key not in seen:
                        seen.add(key)
                        items.append(it)
            except Exception as err:  # une source en panne ne bloque pas les autres
                print(f"Flux ignoré ({source} / {title}) : {err}", file=sys.stderr)
        items.sort(key=lambda x: x["date"], reverse=True)
        if items:
            sections.append({"id": sid, "title": title, "items": items})
    if not sections:
        sys.exit("Aucun flux lisible : news.json est laissé tel quel.")
    out = {"generatedAt": datetime.now(timezone.utc).isoformat(), "sections": sections}
    with open("news.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"news.json : {sum(len(s['items']) for s in sections)} titres dans {len(sections)} rubriques")


if __name__ == "__main__":
    main()
