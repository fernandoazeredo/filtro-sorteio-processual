(() => {
  "use strict";
  const FILTERS=[
    ["ALEATORIO","ALEATÓRIO","01 - ALEATÓRIO"],["IMPROCEDENTE","IMPROCEDENTE","02 - IMPROCEDENTE"],
    ["COMPROMETIDO","COMPROMETIDO","03 - COMPROMETIDO"],["ED","ED","04 - ED"],["EF","EF","05 - EF"],["EP","EP","06 - EP"],
    ["ANA","ANA MULLER","07 - ANA MULLER"],["FLAVIO","FLÁVIO MARQUES","08 - FLÁVIO MARQUES"],
    ["NADJA","NADJA/ANA","09 - NADJA-ANA"],["NADJA/FLAVIO","NADJA/FLÁVIO","10 - NADJA-FLÁVIO"]
  ];
  const RANDOM=new Set(["ALEATORIO","IMPROCEDENTE","COMPROMETIDO","ED","EF","EP"]), FIXED_ANA=new Set(["ANA","NADJA"]);
  const REQ=["Cliente","Número de CNJ","Tipo","Valor da causa","Última Decisão"], COLS=[...REQ,"Sorteado Para"];
  const QTARGET=.60, RANDOM_ATTEMPTS=4000, RANDOM_SWAP_PASSES=20, RANDOM_EARLY_TOLERANCE=.0001;
  const BLUE=[39,72,190],RED=[220,38,38],NAVY=[24,58,96],SLATE=[51,65,85],LBLUE=[76,132,197],ORANGE=[236,125,42];
  const norm=v=>String(v??"").normalize("NFD").replace(/\p{Diacritic}/gu,"").toUpperCase().replace(/\s+/g," ").trim();
  const parse=v=>{if(typeof v==="number")return Number.isFinite(v)?v:0;let t=String(v??"").trim(),neg=/^-|^-\s*R\$|^\(.*\)$/i.test(t);if(/^\(.*\)$/.test(t))t=t.slice(1,-1);t=t.replace(/R\$/gi,"").replace(/-/g,"").replace(/\s/g,"");if(t.includes(","))t=t.replace(/\./g,"").replace(/,/g,".");const n=Number.parseFloat(t);return Number.isFinite(n)?(neg?-n:n):0};
  const val=r=>Math.max(0,parse(r["Valor da causa"])), brl=v=>parse(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const pct=(a,b)=>b?`${((a/b)*100).toFixed(2)}%`:"0.00%";
  const typeGroup=v=>({ALEATORIO:"ALEATORIO",IMPROCEDENTE:"IMPROCEDENTE",COMPROMETIDO:"COMPROMETIDO",ED:"ED",EF:"EF",EP:"EP","ANA MULLER":"ANA","FLAVIO MARQUES":"FLAVIO","NADJA/ANA":"NADJA","NADJA/FLAVIO":"NADJA/FLAVIO"}[norm(v)]||"");

  function readRows(wb){
    const sn=wb.SheetNames.find(n=>norm(n)==="BASE PARA SORTEIO")||wb.SheetNames[0]; if(!sn||!wb.Sheets[sn])throw Error("A planilha não possui uma aba válida para leitura.");
    const raw=XLSX.utils.sheet_to_json(wb.Sheets[sn],{defval:"",raw:true}).filter(r=>String(r.Cliente??"").trim()); if(!raw.length)throw Error("Nenhum processo foi encontrado na planilha.");
    const miss=REQ.filter(c=>!Object.prototype.hasOwnProperty.call(raw[0],c)); if(miss.length)throw Error(`Colunas obrigatórias ausentes: ${miss.join(", ")}.`);
    return raw.map((r,i)=>{const g=typeGroup(r.Tipo);if(!g)throw Error(`Tipo inválido ou vazio na linha ${i+2}: ${r.Tipo||"(vazio)"}.`);return {Cliente:r.Cliente??"","Número de CNJ":r["Número de CNJ"]??"",Tipo:r.Tipo??"","Valor da causa":r["Valor da causa"]??"","Última Decisão":r["Última Decisão"]??"","Sorteado Para":"",__group:g}});
  }
  const quota=rs=>{const f=Math.round(rs.length*QTARGET);return {f,a:rs.length-f}};
  const summary=rs=>{let ac=0,av=0,fc=0,fv=0;for(const r of rs){const v=parse(r["Valor da causa"]);if(r["Sorteado Para"]==="Ana"){ac++;av+=v}else if(r["Sorteado Para"]==="Flávio"){fc++;fv+=v}}return {ac,av,fc,fv,tc:ac+fc,tv:av+fv}};
  function fixed(rs,g){const n=FIXED_ANA.has(g)?"Ana":"Flávio";rs.forEach(r=>r["Sorteado Para"]=n)}
  function shuffled(rs){const a=[...rs];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

  function bestRandomAllocation(rs){
    const q=quota(rs),total=rs.reduce((s,r)=>s+val(r),0),target=total*QTARGET;
    let bestSet=null,bestValue=0,bestError=Infinity;
    for(let attempt=0;attempt<RANDOM_ATTEMPTS;attempt++){
      const order=shuffled(rs),flavio=order.slice(0,q.f),fv=flavio.reduce((s,r)=>s+val(r),0),error=Math.abs(fv-target);
      if(error<bestError){bestError=error;bestValue=fv;bestSet=new Set(flavio)}
      if(total>0&&bestError/total<=RANDOM_EARLY_TOLERANCE)break;
    }
    if(!bestSet)bestSet=new Set(shuffled(rs).slice(0,q.f));
    if(!total)return bestSet;
    for(let pass=0;pass<RANDOM_SWAP_PASSES;pass++){
      const fr=rs.filter(r=>bestSet.has(r)),ar=rs.filter(r=>!bestSet.has(r)),current=Math.abs(bestValue-target);let swap=null,next=current;
      for(const f of fr){const fv=val(f);for(const a of ar){const av=val(a),candidate=bestValue-fv+av,error=Math.abs(candidate-target);if(error+1e-9<next){next=error;swap={f,a,candidate}}}}
      if(!swap)break;bestSet.delete(swap.f);bestSet.add(swap.a);bestValue=swap.candidate;
      if(next/total<=RANDOM_EARLY_TOLERANCE)break;
    }
    return bestSet;
  }

  function balanced(rs){
    if(!rs.length)return;
    rs.forEach(r=>r["Sorteado Para"]="");
    const flavio=bestRandomAllocation(rs);
    rs.forEach(r=>r["Sorteado Para"]=flavio.has(r)?"Flávio":"Ana");
  }

  function allocate(rows){
    for(const [g] of FILTERS){
      const rs=rows.filter(r=>r.__group===g);
      if(RANDOM.has(g))balanced(rs); else fixed(rs,g);
    }
    const missing=rows.filter(r=>!r["Sorteado Para"]);if(missing.length)throw Error(`${missing.length} processo(s) ficaram sem atribuição.`);
  }

  function head(doc,title,when){doc.setTextColor(18,45,92);doc.setFontSize(16);doc.setFont(undefined,"bold");doc.text(title,14,12);doc.setFont(undefined,"normal");doc.setFontSize(7.5);doc.setTextColor(90,100,115);doc.text(`Exportado em: ${when}`,14,18)}
  function metrics(doc,rs,v,s,c,y){doc.autoTable({startY:y,margin:{left:14,right:14},theme:"grid",head:[["Quantidade","Valor Total (R$)","% Quantidade","% Valor"]],body:[[String(rs.length),brl(v),pct(rs.length,s.tc),pct(v,s.tv)]],headStyles:{fillColor:c,textColor:255,halign:"center",fontStyle:"bold",fontSize:8},bodyStyles:{halign:"center",fontSize:8.5,fontStyle:"bold",textColor:[55,65,80]},styles:{cellPadding:2}});return doc.lastAutoTable.finalY+5}
  function table(doc,name,rs,c,y){const start=doc.internal.getNumberOfPages(),body=[...rs].sort((a,b)=>String(a.Cliente||"").localeCompare(String(b.Cliente||""),"pt-BR")).map(r=>COLS.map(x=>x==="Valor da causa"?brl(r[x]):(r[x]??"")));doc.autoTable({startY:y,margin:{left:4,right:4,top:18,bottom:8},head:[COLS.map(x=>x==="Valor da causa"?"Valor da causa (R$)":x)],body,theme:"striped",headStyles:{fillColor:c,textColor:255,fontStyle:"bold",fontSize:6.2,cellPadding:1.1},styles:{fontSize:5.7,cellPadding:.85,overflow:"linebreak",textColor:[45,55,68],valign:"middle"},alternateRowStyles:{fillColor:[245,247,250]},columnStyles:{0:{cellWidth:70},1:{cellWidth:58},2:{cellWidth:27},3:{cellWidth:40},4:{cellWidth:54},5:{cellWidth:24}},didDrawPage:()=>{if(doc.internal.getNumberOfPages()>start){doc.setTextColor(...c);doc.setFontSize(8.5);doc.setFont(undefined,"bold");doc.text(`${name} — continuação`,6,9);doc.setTextColor(45,55,68)}}})}
  function block(doc,title,name,rs,v,s,c,when,newPage){if(newPage)doc.addPage();head(doc,title,when);doc.setFillColor(...c);doc.roundedRect(14,27,269,12,2,2,"F");doc.setTextColor(255);doc.setFontSize(12.5);doc.setFont(undefined,"bold");doc.text(name,19,35);const y=metrics(doc,rs,v,s,c,44);if(rs.length)table(doc,name,rs,c,y)}
  function finalPage(doc,s){doc.addPage();doc.setTextColor(18,45,92);doc.setFont(undefined,"bold");doc.setFontSize(17);doc.text("RESUMO CONSOLIDADO FINAL",14,18);doc.autoTable({startY:31,margin:{left:18,right:18},theme:"grid",head:[["Sócio","Quantidade","% Quantidade","Valor Total (R$)","% Valor"]],body:[["Flávio Marques",s.fc,pct(s.fc,s.tc),brl(s.fv),pct(s.fv,s.tv)],["Ana Paula Bonadiman Muller",s.ac,pct(s.ac,s.tc),brl(s.av),pct(s.av,s.tv)],["Total Geral",s.tc,s.tc?"100%":"0%",brl(s.tv),s.tv?"100%":"0%"]],headStyles:{fillColor:SLATE,textColor:255,halign:"center",fontStyle:"bold",fontSize:10},bodyStyles:{halign:"center",fontSize:10,textColor:[55,65,80],minCellHeight:17},columnStyles:{0:{fontStyle:"bold"}},styles:{cellPadding:3}})}
  function filterPdf(filter,rs){const doc=new window.jspdf.jsPDF({orientation:"landscape",unit:"mm",format:"a4"}),title=`Relatório - ${filter[1]}`,when=new Date().toLocaleString("pt-BR"),s=summary(rs),fr=rs.filter(r=>r["Sorteado Para"]==="Flávio"),ar=rs.filter(r=>r["Sorteado Para"]==="Ana");let used=false;if(fr.length){block(doc,title,"FLÁVIO MARQUES",fr,s.fv,s,BLUE,when,false);used=true}if(ar.length){block(doc,title,"ANA PAULA BONADIMAN MULLER",ar,s.av,s,RED,when,used);used=true}if(!used)head(doc,title,when);finalPage(doc,s);return doc}

  function summaryPdf(rows){
    const doc=new window.jspdf.jsPDF({orientation:"landscape",unit:"mm",format:"a4"}),s=summary(rows),now=new Date().toLocaleString("pt-BR");doc.setFillColor(...NAVY);doc.rect(4,4,289,10,"F");doc.setTextColor(255);doc.setFont(undefined,"bold");doc.setFontSize(14);doc.text("RESUMO CONSOLIDADO DO SORTEIO",148.5,11,{align:"center"});
    doc.autoTable({startY:20,margin:{left:4},tableWidth:138,theme:"plain",head:[["Indicador","Quantidade","% da base total"]],body:[["Total de processos",s.tc,"100,00%"],["Flávio Marques",s.fc,pct(s.fc,s.tc).replace(".",",")],["Ana Paula Bonadiman Muller",s.ac,pct(s.ac,s.tc).replace(".",",")]],headStyles:{fillColor:LBLUE,textColor:255,halign:"center",fontStyle:"bold",fontSize:8},bodyStyles:{fontSize:8,textColor:[25,25,25],cellPadding:1.4},columnStyles:{1:{halign:"right"},2:{halign:"right"}}});
    doc.autoTable({startY:20,margin:{left:151},tableWidth:142,theme:"plain",head:[["Rateio geral","Valor Total (R$)","% do valor"]],body:[["Flávio Marques",brl(s.fv),pct(s.fv,s.tv).replace(".",",")],["Ana Paula Bonadiman Muller",brl(s.av),pct(s.av,s.tv).replace(".",",")],["Total Geral",brl(s.tv),"100,00%"]],headStyles:{fillColor:ORANGE,textColor:255,halign:"center",fontStyle:"bold",fontSize:8},bodyStyles:{fontSize:8,textColor:[25,25,25],cellPadding:1.4},columnStyles:{1:{halign:"right"},2:{halign:"right"}}});
    const body=FILTERS.map(f=>{const x=summary(rows.filter(r=>r.__group===f[0]));return [f[1],x.tc,x.fc,pct(x.fc,x.tc),x.ac,pct(x.ac,x.tc),brl(x.fv),pct(x.fv,x.tv),brl(x.av),pct(x.av,x.tv)]});body.push(["TOTAL GERAL",s.tc,s.fc,pct(s.fc,s.tc),s.ac,pct(s.ac,s.tc),brl(s.fv),pct(s.fv,s.tv),brl(s.av),pct(s.av,s.tv)]);
    doc.autoTable({startY:52,margin:{left:4,right:4},theme:"grid",head:[["Categoria","Total","Qtd Flávio","% Qtd F.","Qtd Ana","% Qtd A.","Valor Flávio","% Valor F.","Valor Ana","% Valor A."]],body,headStyles:{fillColor:[69,119,190],textColor:255,halign:"center",fontStyle:"bold",fontSize:6.8},bodyStyles:{fontSize:6.6,textColor:[25,25,25],cellPadding:1.2},alternateRowStyles:{fillColor:[247,248,250]},columnStyles:{0:{cellWidth:36},1:{cellWidth:18,halign:"right"},2:{cellWidth:22,halign:"right"},3:{cellWidth:20,halign:"right"},4:{cellWidth:19,halign:"right"},5:{cellWidth:20,halign:"right"},6:{cellWidth:38,halign:"right"},7:{cellWidth:22,halign:"right"},8:{cellWidth:38,halign:"right"},9:{cellWidth:22,halign:"right"}}});doc.setFillColor(255,248,214);doc.rect(4,190,289,10,"F");doc.setTextColor(60);doc.setFont(undefined,"italic");doc.setFontSize(7);doc.text(`Gerado em ${now}. Cada filtro sorteável busca individualmente 60% / 40% em quantidade e valor; grupos fixos permanecem integrais.`,6,196);return doc;
  }

  async function zipLib(){if(window.JSZip)return;await new Promise((ok,no)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";s.onload=ok;s.onerror=()=>no(Error("Falha ao carregar o componente ZIP."));document.head.appendChild(s)})}
  async function run(btn){const input=document.getElementById("excelFile"),file=input?.files?.[0];if(!file)return alert("Selecione primeiro a planilha do novo sorteio.");if(!window.XLSX||!window.jspdf?.jsPDF)return alert("Os componentes de Excel/PDF ainda não foram carregados. Atualize a página e tente novamente.");if(!confirm("Executar agora o SORTEIO EM LOTE, aplicando em cada filtro a mesma regra individual de 60% / 40% em quantidade e valor, mantendo os grupos fixos integrais?"))return;const old=btn.textContent;btn.disabled=true;btn.textContent="Processando SORTEIO EM LOTE...";try{await zipLib();const wb=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:"array",cellStyles:true}),rows=readRows(wb);allocate(rows);const zip=new JSZip();let n=0;for(const f of FILTERS){const rs=rows.filter(r=>r.__group===f[0]);if(!rs.length)continue;n+=rs.length;zip.file(`${f[2]}.pdf`,filterPdf(f,rs).output("arraybuffer"))}if(n!==rows.length)throw Error(`${rows.length-n} processo(s) ficaram fora dos relatórios.`);zip.file("11 - RESUMO CONSOLIDADO.pdf",summaryPdf(rows).output("arraybuffer"));const blob=await zip.generateAsync({type:"blob"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`SORTEIO_COMPLETO_RELATORIOS_${new Date().toISOString().slice(0,10)}.zip`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);const s=summary(rows);alert(`SORTEIO EM LOTE concluído. ${rows.length} processos foram atribuídos. Quantidade: Flávio ${pct(s.fc,s.tc)} / Ana ${pct(s.ac,s.tc)}. Valor consolidado: Flávio ${pct(s.fv,s.tv)} / Ana ${pct(s.av,s.tv)}.`)}catch(e){alert(`Erro no SORTEIO EM LOTE: ${e.message}`)}finally{btn.textContent="SORTEIO EM LOTE";btn.disabled=!input.files?.[0]}}
  addEventListener("DOMContentLoaded",()=>{const b=document.getElementById("packageBtn"),i=document.getElementById("excelFile");if(!b||!i)return;b.onclick=null;b.textContent="SORTEIO EM LOTE";b.title="Executa todos os filtros usando a mesma regra do sorteio individual: 60% / 40% em quantidade e valor, com tentativas aleatórias e sem dividir processos.";b.addEventListener("click",()=>run(b));const sync=()=>b.disabled=!i.files?.[0];i.addEventListener("change",()=>setTimeout(sync,0));new MutationObserver(()=>{if(i.files?.[0]&&b.disabled&&b.textContent!=="Processando SORTEIO EM LOTE...")b.disabled=false;if(!i.files?.[0]&&!b.disabled)b.disabled=true}).observe(b,{attributes:true,attributeFilter:["disabled"]});sync()});
})();
