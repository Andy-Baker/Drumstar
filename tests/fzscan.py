# #19: Sichtbarer Text nie unter 11 px (wie der Scan im Mockup docs/mockups/issue-19.html).
# Geprüft: sichtbare Elemente mit eigenem Text sowie Eingabefelder/Auswahllisten; Canvas und SVG ausgenommen.
FZ_MIN = 11
FZ_JS = """(min=>{const out=[];document.querySelectorAll('body *').forEach(el=>{
 if(el instanceof SVGElement||/^(CANVAS|SCRIPT|STYLE|TEMPLATE)$/.test(el.tagName))return;
 const txt=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())||(el.tagName==='INPUT'&&!/range|checkbox|radio|file|color|hidden/.test(el.type))||el.tagName==='SELECT';
 if(!txt)return;
 const r=el.getBoundingClientRect(), cs=getComputedStyle(el);
 if(!r.width||!r.height||cs.visibility==='hidden'||+cs.opacity===0)return;
 const fs=parseFloat(cs.fontSize);
 if(fs<min)out.push((el.id?'#'+el.id:el.tagName.toLowerCase()+'.'+[...el.classList].join('.'))+' '+fs);});
 return [...new Set(out)];})"""

class FzScan:
  def __init__(self): self.bad = []
  async def __call__(self, pg, where):
    self.bad.extend(where + ': ' + x for x in await pg.evaluate(FZ_JS, FZ_MIN))
