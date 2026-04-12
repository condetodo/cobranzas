"""
Convierte el spec markdown del Slice #1 a PDF.

Pipeline: markdown -> HTML (con extensiones) -> PDF (xhtml2pdf)
"""
import os
import sys
from pathlib import Path

import markdown
from xhtml2pdf import pisa

HERE = Path(__file__).parent
MD_FILE = HERE / "2026-04-11-cobranzas-mvp-slice1-design.md"
PDF_FILE = HERE / "2026-04-11-cobranzas-mvp-slice1-design.pdf"

# Leer markdown
md_text = MD_FILE.read_text(encoding="utf-8")

# xhtml2pdf no soporta emoji en las fuentes default. Los reemplazamos
# por placeholders de texto que transmitan el significado.
emoji_replacements = {
    "🟢": "[VERDE]",
    "🟡": "[AMARILLO]",
    "🟠": "[NARANJA]",
    "🔴": "[ROJO]",
    "⛔": "[CRITICO]",
    "💡": "[IDEA]",
    "🧩": "[SEGMENTOS]",
    "🎯": "[PLAN]",
    "🤖": "[BOT]",
    "✨": "[IA]",
    "✓": "[OK]",
    "❌": "[NO]",
    "❓": "[?]",
    "⚠": "[!]",
    "📧": "[MAIL]",
    "📞": "[TEL]",
    "📄": "[DOC]",
    "📅": "[FECHA]",
    "💰": "[$]",
    "🏦": "[BANCO]",
    "🏢": "[EMPRESA]",
    "📈": "[UP]",
    "📉": "[DOWN]",
    "📎": "[ADJ]",
    "📋": "[LISTA]",
    "🧾": "[RECIBO]",
    "→": "->",
    "↑": "^",
    "↓": "v",
    "☑": "[X]",
    "◉": "(o)",
    "○": "( )",
    "•": "*",
    "×": "x",
    "…": "...",
    "—": "--",
    "–": "-",
    "⟳": "(loading)",
    "👉": "->",
    "👁": "[ver]",
    "▶": ">",
    "⭐": "[*]",
    "🌟": "[**]",
    "👀": "[look]",
    "🎨": "[design]",
}
for emo, repl in emoji_replacements.items():
    md_text = md_text.replace(emo, repl)

# Conversión markdown -> HTML
html_body = markdown.markdown(
    md_text,
    extensions=[
        "extra",       # tables, fenced code, attr_list, footnotes, abbr, def_list
        "toc",         # table of contents
        "sane_lists",
        "nl2br",
    ],
    output_format="xhtml",
)

# Marcar los h1 de secciones (todos menos el primero) con class="section"
# para aplicar page-break-before.
import re
_h1_count = [0]
def _tag_h1(match):
    _h1_count[0] += 1
    if _h1_count[0] == 1:
        return match.group(0)  # primer h1 = titulo, sin clase
    # agrega class="section" al h1
    return match.group(0).replace("<h1", '<h1 class="section"', 1)
html_body = re.sub(r"<h1[^>]*>", _tag_h1, html_body)

# Wrapper HTML con CSS optimizado para xhtml2pdf
html_full = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>CobranzasAI - Slice 1 - Diseno del MVP</title>
<style>
  @page {{
    size: A4;
    margin: 2cm 1.8cm 2cm 1.8cm;
    @frame footer {{
      -pdf-frame-content: footerContent;
      bottom: 1cm;
      margin-left: 1.8cm;
      margin-right: 1.8cm;
      height: 1cm;
    }}
  }}

  body {{
    font-family: Helvetica, Arial, sans-serif;
    font-size: 9.5pt;
    color: #1a1a1a;
    line-height: 1.45;
  }}

  h1 {{
    font-size: 20pt;
    color: #0b3d2e;
    border-bottom: 2pt solid #0b3d2e;
    padding-bottom: 4pt;
    margin-top: 18pt;
    margin-bottom: 10pt;
    -pdf-keep-with-next: true;
  }}
  /* Page break ANTES de cada seccion numerada (h1 que no sea el titulo).
     El primer h1 es el titulo y se queda en la primera pagina. */
  h1.section {{
    page-break-before: always;
  }}
  h2 {{
    font-size: 14pt;
    color: #0b3d2e;
    margin-top: 16pt;
    margin-bottom: 6pt;
    border-bottom: 0.5pt solid #c8d6cf;
    padding-bottom: 2pt;
  }}
  h3 {{
    font-size: 11.5pt;
    color: #1f5745;
    margin-top: 12pt;
    margin-bottom: 4pt;
  }}
  h4 {{
    font-size: 10.5pt;
    color: #1f5745;
    margin-top: 10pt;
    margin-bottom: 4pt;
  }}

  p {{
    margin: 4pt 0;
    text-align: justify;
  }}

  strong {{
    color: #0b3d2e;
  }}

  code {{
    font-family: "Courier New", Courier, monospace;
    font-size: 8.5pt;
    background-color: #f0f3f1;
    padding: 1pt 3pt;
    border-radius: 2pt;
  }}

  pre {{
    font-family: "Courier New", Courier, monospace;
    font-size: 7.5pt;
    background-color: #f6f8f7;
    border: 0.5pt solid #d5dfda;
    padding: 8pt;
    margin: 6pt 0;
    line-height: 1.25;
    white-space: pre-wrap;
    word-wrap: break-word;
    page-break-inside: avoid;
  }}

  pre code {{
    background-color: transparent;
    padding: 0;
    font-size: 7.5pt;
  }}

  table {{
    border-collapse: collapse;
    width: 100%;
    margin: 6pt 0;
    font-size: 8.5pt;
  }}
  th {{
    background-color: #e8efe9;
    color: #0b3d2e;
    padding: 4pt 6pt;
    border: 0.5pt solid #b5c4bc;
    text-align: left;
    font-weight: bold;
  }}
  td {{
    padding: 3pt 6pt;
    border: 0.5pt solid #d5dfda;
    vertical-align: top;
  }}
  tr:nth-child(even) td {{
    background-color: #f9faf9;
  }}

  ul, ol {{
    margin: 4pt 0 4pt 14pt;
    padding: 0;
  }}
  li {{
    margin: 2pt 0;
  }}

  blockquote {{
    margin: 6pt 12pt;
    padding: 4pt 8pt;
    border-left: 2pt solid #0b3d2e;
    color: #3a4a43;
    font-style: italic;
  }}

  hr {{
    border: none;
    border-top: 0.5pt solid #c8d6cf;
    margin: 10pt 0;
  }}

  .page-break {{
    page-break-after: always;
  }}

  #footerContent {{
    font-size: 7.5pt;
    color: #7a8880;
    text-align: center;
  }}
</style>
</head>
<body>
<div id="footerContent">
  CobranzasAI Slice 1 Design -- 2026-04-11 -- Pagina <pdf:pagenumber/> de <pdf:pagecount/>
</div>
{html_body}
</body>
</html>
"""

# Generar PDF
print(f"Generando PDF: {PDF_FILE}")
with open(PDF_FILE, "wb") as out_file:
    result = pisa.CreatePDF(
        src=html_full,
        dest=out_file,
        encoding="utf-8",
    )

if result.err:
    print(f"ERROR: {result.err}")
    sys.exit(1)

size_kb = PDF_FILE.stat().st_size / 1024
print(f"PDF generado OK. Tamano: {size_kb:.1f} KB")
print(f"Ruta: {PDF_FILE}")
