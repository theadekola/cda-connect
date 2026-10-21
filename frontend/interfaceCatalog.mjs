import ts from 'typescript';
const attrs=new Set(['title','subtitle','label','placeholder','description','text','aria-label']);
const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'};
function decode(text){return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi,(match,key)=>{if(key[0]!=='#')return entities[key]??match;const n=key[1]?.toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return Number.isInteger(n)&&n>=0&&n<=0x10ffff?String.fromCodePoint(n):match})}
export function interfaceEdits(code,id='source.tsx'){
 const tree=ts.createSourceFile(id,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[];
 const add=(node,text,attribute=false)=>{if(text.trim())edits.push({start:node.getStart(tree),end:node.end,text,attribute})};
 function expression(node){
  if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))add(node,node.text);
  else if(ts.isConditionalExpression(node)){expression(node.whenTrue);expression(node.whenFalse)}
  else if(ts.isParenthesizedExpression(node))expression(node.expression);
  else if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken)expression(node.right);
 }
 function visit(node){
  if(ts.isJsxText(node)){
   const raw=code.slice(node.pos,node.end),text=decode(raw.includes('\n')?raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).join(' '):raw);
   if(text.trim())edits.push({start:node.pos,end:node.end,text,attribute:true});
  }else if(ts.isJsxAttribute(node)&&attrs.has(node.name.getText(tree))&&node.initializer){
   if(ts.isStringLiteral(node.initializer))add(node.initializer,decode(node.initializer.text),true);
   else if(ts.isJsxExpression(node.initializer)&&node.initializer.expression)expression(node.initializer.expression);
  }else if(ts.isJsxExpression(node)&&!ts.isJsxAttribute(node.parent)&&node.expression)expression(node.expression);
  ts.forEachChild(node,visit);
 }
 visit(tree);return edits;
}
