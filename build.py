#!/usr/bin/env python3
"""Assemble le site : remplit src/gabarit.html avec les fichiers de src/ et de data/ et écrit index.html.
Usage : python3 build.py          écrit index.html
        python3 build.py --check  vérifie que index.html est à jour (code de sortie 1 sinon)"""
import base64, os, re, sys
RACINE = os.path.dirname(os.path.abspath(__file__))

def lire(chemin, binaire=False):
    with open(os.path.join(RACINE, chemin), "rb" if binaire else "r", **({} if binaire else {"encoding": "utf-8"})) as f:
        return f.read()

def assembler():
    t = lire("src/gabarit.html")
    def remplace(m):
        genre, chemin = m.group(1), m.group(2)
        if genre == "FILE":
            return lire(chemin)
        if genre == "ESC":        # fichier inséré dans une balise <script> : « </script> » doit être échappé
            return lire(chemin).replace("</script>", "<\\/script>")
        if genre == "ESCJSON":    # données JSON insérées dans une balise <script>
            return lire(chemin).replace("</", "<\\/")
        if genre == "B64":
            return base64.b64encode(lire(chemin, True)).decode()
        raise ValueError(genre)
    return re.sub(r"@@(FILE|ESC|ESCJSON|B64):([^@]+)@@", remplace, t)

if __name__ == "__main__":
    html = assembler()
    cible = os.path.join(RACINE, "index.html")
    if "--check" in sys.argv:
        actuel = open(cible, encoding="utf-8").read() if os.path.exists(cible) else ""
        if actuel != html:
            print("index.html n'est pas à jour : lancez python3 build.py"); sys.exit(1)
        print("index.html est à jour"); sys.exit(0)
    with open(cible, "w", encoding="utf-8", newline="") as f:
        f.write(html)
    print("index.html écrit,", len(html) // 1024, "Ko")
