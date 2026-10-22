"""Read inert OOXML parts only. No Office execution, external resource fetch, or disk extraction."""
import sys,json,zipfile,posixpath,re,io,xml.etree.ElementTree as ET
from xml.parsers import expat

class Refused(Exception):
 def __init__(self,code,message): self.code,self.message=code,message

def refuse(code,message): raise Refused(code,message)
def local(tag): return tag.rsplit('}',1)[-1]
def children(node,name): return [e for e in node if local(e.tag)==name]
def descendants(node,name): return [e for e in node.iter() if local(e.tag)==name]
def attr(node,name,default=None): return next((v for k,v in node.attrib.items() if local(k)==name),default)
def text(node):
 # Preserve explicit separators, never insert whitespace between adjacent runs.
 parts=[]
 for e in node.iter():
  kind=local(e.tag)
  if kind=='t':parts.append(e.text or '')
  elif kind=='tab':parts.append('\t')
  elif kind in ('br','cr'):parts.append('\n')
 return ''.join(parts)

def safe_xml(data):
 builder=ET.TreeBuilder();parser=expat.ParserCreate(namespace_separator='}');nodes=0;depth=0
 def qname(name):return '{'+name if '}' in name else name
 def start(name,attrs):
  nonlocal nodes,depth
  nodes+=1;depth+=1
  if nodes>250000 or depth>128:refuse('CONTAINER_LIMIT','XML node/depth limit')
  builder.start(qname(name),{qname(k):v for k,v in attrs.items()})
 def end(name):
  nonlocal depth
  builder.end(qname(name));depth-=1
 def unsafe(*args):refuse('UNSAFE_XML','DTD and entity declarations are refused independently of XML encoding')
 parser.StartElementHandler=start;parser.EndElementHandler=end;parser.CharacterDataHandler=builder.data
 parser.StartDoctypeDeclHandler=unsafe;parser.EntityDeclHandler=unsafe;parser.ExternalEntityRefHandler=unsafe
 parser.SetParamEntityParsing(expat.XML_PARAM_ENTITY_PARSING_NEVER)
 try:parser.Parse(data,True);return builder.close()
 except (expat.ExpatError,ValueError,LookupError) as error:
  if 'encoding' in str(error).lower() or data[:4] in (b'\xff\xfe\x00\x00',b'\x00\x00\xfe\xff'):refuse('XML_ENCODING','XML encoding is unsupported or inconsistent')
  refuse('CORRUPT_DOCUMENT','Malformed XML')
def run(path,opts):
 try: z=zipfile.ZipFile(path)
 except zipfile.BadZipFile: refuse('CORRUPT_CONTAINER','ZIP central directory is invalid')
 info=z.infolist(); names=[e.filename for e in info]
 if len(info)>5000 or sum(e.file_size for e in info)>64*1024*1024: refuse('CONTAINER_LIMIT','At most 5000 entries and 64 MiB uncompressed')
 if len(names)!=len(set(names)): refuse('UNSAFE_CONTAINER','Duplicate ZIP member')
 for e in info:
  n=e.filename
  if n.startswith('/') or '\\' in n or any(v in ('.','..') for v in n.split('/')) or len(n.split('/'))>16 or '\x00' in n: refuse('UNSAFE_CONTAINER','Invalid ZIP path')
  if (e.external_attr>>16)&0o170000==0o120000: refuse('UNSAFE_CONTAINER','ZIP symlink refused')
  if e.flag_bits&1: refuse('ENCRYPTED_DOCUMENT','Encrypted ZIP member')
  if e.file_size>8*1024*1024 or e.file_size>max(1024*1024,e.compress_size*200): refuse('CONTAINER_LIMIT','Member or compression ratio limit')
  if n.lower().endswith('vbaproject.bin'): refuse('UNSUPPORTED_MACRO','Macro document is not admitted')
 if '[Content_Types].xml' not in names: refuse('UNSUPPORTED_FORMAT','Not an OOXML package')
 cache={}
 def xml(name):
  if name in cache:return cache[name]
  try:b=z.read(name)
  except KeyError:refuse('CORRUPT_DOCUMENT','Required OOXML part is missing')
  r=safe_xml(b)
  cache[name]=r;return r
 ct=xml('[Content_Types].xml')
 if any('macroEnabled' in str(e.attrib) for e in ct):refuse('UNSUPPORTED_MACRO','Macro content type')
 limits=['Embedded pictures/charts/OLE are not interpreted; external links are never followed; no formula calculation']
 def rels(base):
  relname=posixpath.join(posixpath.dirname(base),'_rels',posixpath.basename(base)+'.rels')
  if relname not in names:return {}
  result={}
  for e in xml(relname):
   target=attr(e,'Target','')
   if attr(e,'TargetMode')=='External':continue
   dest=posixpath.normpath(target.lstrip('/') if target.startswith('/') else posixpath.join(posixpath.dirname(base),target))
   if dest.startswith('../') or dest.startswith('/') or ':' in dest or '\\' in dest:refuse('UNSAFE_CONTAINER','Relationship escapes package')
   result[attr(e,'Id')]=(dest,attr(e,'Type',''))
  return result
 def selection(total,default=10):
  a=opts.get('start',1);b=opts.get('end',min(total,a+default-1))
  if not isinstance(a,int) or not isinstance(b,int) or a<1 or b<a or b>total or b-a>=100:refuse('RANGE_LIMIT','Select 1 to 100 existing units')
  return a,b
 result={'limitations':limits}
 if 'word/document.xml' in names:
  if not any('wordprocessingml.document.main+xml' in attr(e,'ContentType','') for e in ct):refuse('TYPE_MISMATCH','DOCX content type required')
  root=xml('word/document.xml');bodies=descendants(root,'body')
  if not bodies:refuse('CORRUPT_DOCUMENT','Word body is missing')
  rels('word/document.xml')
  body=bodies[0];blocks=[];omissions=[]
  wrappers={'sdtContent','customXml','smartTag','ins','moveTo'}
  ignored={'tcPr','sectPr','sdtPr','sdtEndPr','bookmarkStart','bookmarkEnd','proofErr','permStart','permEnd','commentRangeStart','commentRangeEnd'}
  def omission(e,path):omissions.append({'path':path,'element':local(e.tag),'reason':'Unsupported body structure; content may be omitted'})
  def walk(parent,path):
   for index,e in enumerate(parent,1):
    kind=local(e.tag);where=path+'/'+kind+'['+str(index)+']'
    if kind in ('p','tbl'):yield e,where
    elif kind=='sdt':
     found=False
     for sub in children(e,'sdtContent'):
      found=True;yield from walk(sub,where+'/sdtContent')
     if not found:omission(e,where)
    elif kind in wrappers:yield from walk(e,where)
    elif kind not in ignored:omission(e,where)
  def paragraph(e,path):
   # Textbox paragraphs and revision-deleted text are not silently flattened.
   parts=[]
   def inline(n,where):
    kind=local(n.tag)
    if kind in ('txbxContent','drawing','pict','object','del','moveFrom','altChunk'):
     omission(n,where);return
    if kind=='t':parts.append(n.text or '');return
    if kind=='tab':parts.append('\t');return
    if kind in ('br','cr'):parts.append('\n');return
    for i,c in enumerate(n,1):inline(c,where+'/'+local(c.tag)+'['+str(i)+']')
   inline(e,path);return ''.join(parts)
  def block(e,path):
   if local(e.tag)=='p':
    styles=descendants(e,'pStyle');return {'kind':'paragraph','path':path,'style':attr(styles[0],'val') if styles else None,'text':paragraph(e,path)}
   rows=[]
   for ri,row in enumerate(children(e,'tr'),1):
    cells=[]
    for ci,cell in enumerate(children(row,'tc'),1):
     where=path+'/tr['+str(ri)+']/tc['+str(ci)+']';nested=[block(n,loc) for n,loc in walk(cell,where)]
     cells.append({'path':where,'text':'\n'.join(n['text'] for n in nested if n['kind']=='paragraph'),'blocks':nested,'gridSpan':[attr(x,'val') for props in children(cell,'tcPr') for x in descendants(props,'gridSpan')],'verticalMerge':[attr(x,'val','continue') for props in children(cell,'tcPr') for x in descendants(props,'vMerge')]})
    rows.append(cells)
   return {'kind':'table','path':path,'rows':rows}
  for e,path in walk(body,'word/document.xml/body'):
   blocks.append({'block':len(blocks)+1,**block(e,path)})
  a,b=selection(len(blocks)) if blocks else (1,0)
  result.update(format='docx',omissions=omissions,contentStatus='partial' if omissions else 'empty' if not blocks else 'complete-with-declared-limits',records=blocks[a-1:b],totalUnits=len(blocks),nextStart=b+1 if b<len(blocks) else None,embeddedResources=[n for n in names if n.startswith('word/media/')],omittedParts=[n for n in names if re.match(r'word/(header|footer|footnotes|endnotes|comments)',n)])
 elif 'xl/workbook.xml' in names:
  if not any('spreadsheetml.sheet.main+xml' in attr(e,'ContentType','') for e in ct):refuse('TYPE_MISMATCH','XLSX content type required')
  workbook=xml('xl/workbook.xml');relationships=rels('xl/workbook.xml');sheets=[]
  for sheet in descendants(workbook,'sheet'):
   rel=relationships.get(attr(sheet,'id'));sheets.append({'name':attr(sheet,'name'),'state':attr(sheet,'state','visible'),'part':rel[0] if rel else None})
  chosen=next((s for s in sheets if s['name']==opts.get('sheet',sheets[0]['name'])),None)
  if not chosen or not chosen['part']:refuse('SHEET_NOT_FOUND','Select a workbook sheet by name')
  rng=opts.get('range','A1:T50');m=re.fullmatch(r'([A-Z]{1,3})([1-9][0-9]{0,6}):([A-Z]{1,3})([1-9][0-9]{0,6})',rng)
  if not m:refuse('CELL_RANGE','Use an explicit A1:B20 range')
  def column(c):
   v=0
   for ch in c:v=v*26+ord(ch)-64
   return v
  c1,r1,c2,r2=column(m[1]),int(m[2]),column(m[3]),int(m[4])
  if c2<c1 or r2<r1 or c2>16384 or r2>1048576 or (c2-c1+1)*(r2-r1+1)>10000:refuse('CELL_RANGE','Select at most 10000 valid cells')
  strings=[text(e) for e in children(xml('xl/sharedStrings.xml'),'si')] if 'xl/sharedStrings.xml' in names else []
  root=xml(chosen['part']);records=[]
  for row in descendants(root,'row'):
   for cell in children(row,'c'):
    address=attr(cell,'r','');match=re.fullmatch(r'([A-Z]+)([0-9]+)',address)
    if not match:refuse('CORRUPT_DOCUMENT','Cell has no valid address')
    if not(c1<=column(match[1])<=c2 and r1<=int(match[2])<=r2):continue
    kind=attr(cell,'t','n');v=children(cell,'v');value=v[0].text if v else None;formula=children(cell,'f')
    if kind=='s' and value is not None:
     try:value=strings[int(value)]
     except (ValueError,IndexError):refuse('CORRUPT_DOCUMENT','Invalid shared string index')
    if kind=='inlineStr':value=text(cell)
    records.append({'cell':address,'type':kind,'value':value,'formula':formula[0].text if formula else None,'formulaAttributes':formula[0].attrib if formula else None,'cachedValuePresent':bool(v) and v[0].text is not None if formula else None,'rowHidden':attr(row,'hidden','0')=='1','styleIndex':attr(cell,'s')})
  result.update(format='xlsx',sheets=[{k:v for k,v in s.items() if k!='part'} for s in sheets],sheet=chosen['name'],range=rng,records=records,mergedCells=[attr(e,'ref') for e in descendants(root,'mergeCell')],columns=[e.attrib for e in descendants(root,'col')],date1904=any(attr(e,'date1904','0')=='1' for e in descendants(workbook,'workbookPr')),nextStart=None)
  limits.append('Numeric/date values are raw XML lexical values with style indices; absent cells are blank, missing formula cache is null, shared formula metadata is retained without expansion')
 elif 'ppt/presentation.xml' in names:
  if not any('presentationml.presentation.main+xml' in attr(e,'ContentType','') for e in ct):refuse('TYPE_MISMATCH','PPTX content type required')
  rel=rels('ppt/presentation.xml');order=[rel[e.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')][0] for e in descendants(xml('ppt/presentation.xml'),'sldId') if e.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id') in rel];a,b=selection(len(order));records=[]
  for i in range(a-1,b):
   part=order[i];root=xml(part);shapes=[]
   tree=descendants(root,'spTree')
   for shape in tree[0] if tree else []:
    if local(shape.tag)=='sp':shapes.append({'kind':'text','paragraphs':[text(p) for p in descendants(shape,'p')]})
    elif local(shape.tag)=='graphicFrame':
     for table in descendants(shape,'tbl'):shapes.append({'kind':'table','rows':[[text(c) for c in children(row,'tc')] for row in children(table,'tr')]})
   notes=[]
   if opts.get('includeNotes',False):
    for dest,typ in rels(part).values():
     if typ.endswith('/notesSlide'):notes.extend(text(p) for p in descendants(xml(dest),'p'))
   records.append({'slide':i+1,'shapes':shapes,'speakerNotes':notes if opts.get('includeNotes') else None,'notesIncluded':bool(opts.get('includeNotes')),'embeddedResources':[dest for dest,typ in rels(part).values() if typ.endswith('/image')]})
  result.update(format='pptx',records=records,totalUnits=len(order),nextStart=b+1 if b<len(order) else None)
  limits.append('Slide shape order is preserved; grouped shapes, master/layout text, animations and chart values are not extracted; notes are separate when requested')
 else:refuse('UNSUPPORTED_FORMAT','No supported DOCX/XLSX/PPTX main part')
 return result
try:
 result=run(sys.argv[1],json.loads(sys.argv[2]));encoded=json.dumps(result,ensure_ascii=False)
 if len(encoded.encode())>6*1024*1024:refuse('OUTPUT_LIMIT','Narrow the selected range')
 print(encoded)
except Refused as e: print(json.dumps({'error':e.code,'message':e.message}));sys.exit(1)
except Exception as e: print(json.dumps({'error':'CORRUPT_DOCUMENT','message':type(e).__name__+': malformed document'}));sys.exit(1)
