#!/usr/bin/env python3
"""Fabrique news.json à partir des flux RSS publics de la presse française.

Sources : Le Monde, franceinfo, Le Figaro, BFM TV, 20 Minutes, France 24,
Le Parisien, Libération, Courrier international, L'Équipe et RMC Sport.

Lancé chaque matin par la tâche planifiée GitHub (.github/workflows/news.yml).
L'app lit ensuite news.json : aucun service payant, aucune clé.
Pour changer les rubriques ou les sources, modifie la liste SECTIONS.
Le nom d'une source doit être écrit pareil dans toutes les rubriques
(l'app s'en sert pour son filtre par source).
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
    ("une", "À la une", [
        ("Le Monde", "https://www.lemonde.fr/rss/une.xml"),
        ("franceinfo", "https://www.francetvinfo.fr/titres.rss"),
        ("Le Figaro", "https://www.lefigaro.fr/rss/figaro_actualites.xml"),
        ("BFM TV", "https://www.bfmtv.com/rss/news-24-7/"),
        ("20 Minutes", "https://www.20minutes.fr/feeds/rss-une.xml"),
        ("France 24", "https://www.france24.com/fr/rss"),
        ("Le Parisien", "https://feeds.leparisien.fr/leparisien/rss"),
        ("Libération", "https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml"),
    ]),
    ("eco", "Économie", [
        ("Le Monde", "https://www.lemonde.fr/economie/rss_full.xml"),
        ("franceinfo", "https://www.francetvinfo.fr/economie.rss"),
        ("Le Figaro", "https://www.lefigaro.fr/rss/figaro_economie.xml"),
        ("BFM TV", "https://www.bfmtv.com/rss/economie/"),
        ("20 Minutes", "https://www.20minutes.fr/feeds/rss-economie.xml"),
        ("France 24", "https://www.france24.com/fr/%C3%A9co-tech/rss"),
    ]),
    ("monde", "Monde", [
        ("Le Monde", "https://www.lemonde.fr/international/rss_full.xml"),
        ("franceinfo", "https://www.francetvinfo.fr/monde.rss"),
        ("Le Figaro", "https://www.lefigaro.fr/rss/figaro_international.xml"),
        ("BFM TV", "https://www.bfmtv.com/rss/international/"),
        ("20 Minutes", "https://www.20minutes.fr/feeds/rss-monde.xml"),
        ("Courrier international", "https://www.courrierinternational.com/feed/all/rss.xml"),
    ]),
    ("sport", "Sport", [
        ("franceinfo", "https://www.francetvinfo.fr/sports.rss"),
        ("Le Monde", "https://www.lemonde.fr/sport/rss_full.xml"),
        ("Le Figaro", "https://www.lefigaro.fr/rss/figaro_sport.xml"),
        ("L'Équipe", "https://dwh.lequipe.fr/api/edito/rss?path=/"),
        ("RMC Sport", "https://rmcsport.bfmtv.com/rss/fil-sport/"),
        ("20 Minutes", "https://www.20minutes.fr/feeds/rss-sport.xml"),
    ]),
]
PAR_SOURCE = 6   # nombre de titres gardés par source et par rubrique


def clean(text, limit):
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = re.sub(r"\s+", " ", html.unescape(text)).strip()
    if len(text) > limit:
        text = text[:limit].rsplit(" ", 1)[0] + "…"
    return text


def download(url):
    """Télécharge un flux et renvoie son contenu brut (octets)."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (lecteur RSS)"})
    with urllib.request.urlopen(req, timeout=20) as res:
        return res.read()


def local(tag):
    """Nom d'une balise sans son espace de noms : '{http://…/Atom}entry' -> 'entry'."""
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def child(el, *names):
    """Premier enfant direct portant l'un de ces noms.

    On préfère la balise sans espace de noms (RSS classique), sinon on accepte
    la même avec un espace de noms (Atom, Dublin Core…). Les balises « media: »
    sont écartées : media:title est le titre d'une image, pas celui de l'article.
    """
    for name in names:
        for c in el:
            if c.tag == name:
                return c
        for c in el:
            if local(c.tag) == name and "mrss" not in c.tag:
                return c
    return None


def text_of(el, *names):
    c = child(el, *names)
    return "".join(c.itertext()).strip() if c is not None else ""


def find_link(it):
    """Adresse de l'article : <link>texte</link> (RSS) ou <link href="…"/> (Atom)."""
    link = text_of(it, "link")
    if not link.startswith("http"):
        # Atom : plusieurs <link> possibles, on prend celui de la page (rel absent ou "alternate")
        for c in it:
            if local(c.tag) == "link" and c.get("href") and c.get("rel", "alternate") == "alternate":
                link = c.get("href").strip()
                break
    if not link.startswith("http"):
        link = text_of(it, "guid", "id")   # dernier recours : l'identifiant est souvent l'adresse
    return link if link.startswith("http") else ""


def parse_date(text):
    """Date du flux -> texte ISO en UTC, ou "" si elle est absente ou illisible."""
    text = (text or "").strip()
    if not text:
        return ""
    try:
        d = parsedate_to_datetime(text)                           # RSS : "Sat, 14 Nov 2026 08:00:00 +0100"
    except Exception:
        try:
            d = datetime.fromisoformat(text.replace("Z", "+00:00"))  # Atom : "2026-11-14T08:00:00Z"
        except Exception:
            return ""
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc).isoformat()


def parse_feed(source, data):
    """Lit un flux RSS, RDF ou Atom (octets) et renvoie tous ses articles, dans l'ordre du flux."""
    root = ET.fromstring(data.strip())
    items = []
    for it in root.iter():
        if local(it.tag) not in ("item", "entry"):   # item = RSS, entry = Atom
            continue
        title = clean(text_of(it, "title"), 200)
        link = find_link(it)
        if not title or not link:
            continue
        desc = clean(text_of(it, "description", "summary", "content"), 220)
        date = parse_date(text_of(it, "pubDate", "published", "updated", "date"))
        items.append({"title": title, "desc": desc, "link": link, "source": source, "date": date})
    return items


def read_feed(source, url):
    return parse_feed(source, download(url))


def main():
    sections, seen = [], set()
    for sid, title, feeds in SECTIONS:
        items = []
        for source, url in feeds:
            try:
                kept = 0
                for it in read_feed(source, url):
                    key = it["link"].split("#")[0]   # sans le suffixe de suivi (#xtor=…) qui change selon la rubrique
                    if key in seen:   # déjà pris ailleurs : on passe au suivant du même flux
                        continue
                    seen.add(key)
                    items.append(it)
                    kept += 1
                    if kept >= PAR_SOURCE:
                        break
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
