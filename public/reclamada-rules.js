/* Mesma reclamada permanece com um único sócio em toda a base. */
((root) => {
  'use strict';
  const key = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const fixed = row => ({COMPROMETIDO:'Flávio','ANA MULLER':'Ana','FLAVIO MARQUES':'Flávio','NADJA/ANA':'Ana','NADJA/FLAVIO':'Flávio'}[key(row.Tipo)] || '');
  const owner = row => key(row['Sorteado Para']).includes('FLAVIO') ? 'Flávio' : key(row['Sorteado Para']).includes('ANA') ? 'Ana' : '';
  function units(rows) {
    const parents=rows.map((_,i)=>i), names=new Map(), cnjs=new Map();
    const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
    const join=(i,j)=>{parents[find(j)]=find(i);};
    rows.forEach((row,index)=>{
      const name=key(row.Reclamada), cnj=String(row['Número de CNJ']??'').replace(/[^0-9]/g,'');
      if(!name && cnj.length!==20)throw Error(`Linha ${index+2} sem Reclamada e sem CNJ completo. Informe uma identificação antes de sortear.`);
      if(name){if(names.has(name))join(index,names.get(name));else names.set(name,index);}
      if(cnj.length===20){if(!cnjs.has(cnj))cnjs.set(cnj,[]);cnjs.get(cnj).push(index);}
    });
    for(const indices of cnjs.values()) {
      if(!indices.some(i=>!key(rows[i].Reclamada)))continue;
      const known=new Set(indices.map(i=>key(rows[i].Reclamada)).filter(Boolean));
      if(known.size>1)throw Error('CNJ associado a reclamadas diferentes: confira a linha sem Reclamada antes de sortear.');
      for(const i of indices)join(indices[0],i);
    }
    const groups = new Map();
    rows.forEach((row, index) => {
      const name = find(index);
      if (!groups.has(name)) groups.set(name, {name, rows:[], owner:''});
      const group = groups.get(name);
      for (const assigned of [fixed(row), owner(row)].filter(Boolean)) {
        if (group.owner && group.owner !== assigned) throw Error(`A reclamada ${String(row.Reclamada)} possui sócios incompatíveis. Revise os Tipos fixos e as atribuições antes de sortear.`);
        group.owner = assigned;
      }
      group.rows.push(row);
    });
    return [...groups.values()];
  }
  function assign(rows, selected, valueOf, random = Math.random) {
    const all = units(rows); // Validate before mutating any assignment.
    const selection = new Set(selected);
    const touched = all.filter(g => g.rows.some(r => selection.has(r)));
    const candidates = touched.filter(g => !g.owner).map(g => ({...g, count:g.rows.filter(r => selection.has(r)).length, value:g.rows.filter(r => selection.has(r)).reduce((s,r) => s + Math.max(0,valueOf(r)),0)}));
    const total = selected.reduce((s,r) => s + Math.max(0,valueOf(r)),0);
    const targetCount = Math.round(selected.length * .6), targetValue = total * .6;
    const pinned = touched.filter(g => g.owner === 'Flávio').flatMap(g => g.rows).filter(r => selection.has(r));
    const pinnedCount = pinned.length, pinnedValue = pinned.reduce((s,r) => s + Math.max(0,valueOf(r)),0);
    const score = (n,v) => [Math.abs(n-targetCount), Math.abs(v-targetValue)];
    const better = (a,b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1] - 1e-7);
    let best = new Set(), bestScore = [Infinity,Infinity];
    for (let attempt=0; attempt<Math.min(1000,Math.max(50,candidates.length*8)); attempt++) {
      const order = [...candidates];
      for (let i=order.length-1;i>0;i--) {const j=Math.floor(random()*(i+1)); [order[i],order[j]]=[order[j],order[i]];}
      let count=pinnedCount, value=pinnedValue; const chosen=new Set();
      for (const g of order) {
        if (better(score(count+g.count,value+g.value),score(count,value))) {chosen.add(g.name); count+=g.count; value+=g.value;}
      }
      const candidateScore=score(count,value);
      if (better(candidateScore,bestScore)) {best=chosen; bestScore=candidateScore;}
      if(bestScore[0]===0 && (!total || bestScore[1]/total<=.0001))break;
    }
    for (const g of touched) {
      const assigned=g.owner || (best.has(g.name)?'Flávio':'Ana');
      g.rows.forEach(r => r['Sorteado Para']=assigned);
    }
    return selected.length;
  }
  root.FSPReclamadaRules = Object.freeze({key, validate:rows=>units(rows), assign});
})(typeof window === 'undefined' ? globalThis : window);
