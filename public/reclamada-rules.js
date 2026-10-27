/* Somente o reclamante identifica o grupo indivisível; reclamada não agrupa processos. */
((root) => {
  'use strict';
  const key = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const fixed = row => ({COMPROMETIDO:'Flávio','ANA MULLER':'Ana','FLAVIO MARQUES':'Flávio','NADJA/ANA':'Ana','NADJA/FLAVIO':'Flávio'}[key(row.Tipo)] || '');
  const owner = row => key(row['Sorteado Para']).includes('FLAVIO') ? 'Flávio' : key(row['Sorteado Para']).includes('ANA') ? 'Ana' : '';
  function units(rows) {
    const groups = new Map();
    rows.forEach((row, index) => {
      const claimant = key(row.Reclamante);
      if (!claimant) throw Error(`Linha ${index+2} sem Reclamante.`);
      if (!groups.has(claimant)) groups.set(claimant, {name: claimant, rows:[], owner:''});
      const group = groups.get(claimant);
      for (const assigned of [fixed(row), owner(row)].filter(Boolean)) {
        if (group.owner && group.owner !== assigned)
          throw Error(`O reclamante ${row.Reclamante} possui atribuições incompatíveis. Confira Tipos fixos e a coluna Sorteado Para.`);
        group.owner = assigned;
      }
      group.rows.push(row);
    });
    return [...groups.values()];
  }
  function assign(rows, selected, valueOf, random) {
    // A mesma base produz a mesma sequência pseudoaleatória em ambos os fluxos.
    if (!random) {
      let seed = 2166136261;
      for (const row of selected) {
        const token = [key(row.Reclamante), key(row['Número de CNJ']), key(row.Tipo), valueOf(row)].join('|');
        for (let i=0;i<token.length;i++) seed = Math.imul(seed ^ token.charCodeAt(i), 16777619) >>> 0;
      }
      random = () => {
        seed = (seed + 0x6D2B79F5) >>> 0;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const all = units(rows); // Validate before mutating any assignment.
    const selection = new Set(selected);
    const touched = all.filter(g => g.rows.some(r => selection.has(r)));
    const candidates = touched.filter(g => !g.owner).map(g => ({...g, count:g.rows.filter(r => selection.has(r)).length, value:g.rows.filter(r => selection.has(r)).reduce((s,r) => s + Math.max(0,valueOf(r)),0)}));
    const total = selected.reduce((s,r) => s + Math.max(0,valueOf(r)),0);
    const targetCount = Math.round(selected.length * .6), targetValue = total * .6;
    const pinned = touched.filter(g => g.owner === 'Flávio').flatMap(g => g.rows).filter(r => selection.has(r));
    const pinnedCount = pinned.length, pinnedValue = pinned.reduce((s,r) => s + Math.max(0,valueOf(r)),0);
    const score = (n,v) => [Math.abs(v-targetValue), Math.abs(n-targetCount)];
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
      if(bestScore[0] <= Math.max(0.01,total*.000001) && bestScore[1] === 0)break;
    }
    // Prioridade: valor total 60/40; a quantidade desempata o desvio em reais.
    // Cada movimento troca reclamantes inteiros, sem considerar reclamada.
    const current = () => {
      let n=pinnedCount,v=pinnedValue;
      for(const g of candidates) if(best.has(g.name)){n+=g.count;v+=g.value;}
      return {n,v};
    };
    for(let pass=0;pass<12;pass++){
      const base=current();
      let bestMove=null, bestCandidateScore=score(base.n,base.v);
      const left=candidates.filter(g=>best.has(g.name));
      const right=candidates.filter(g=>!best.has(g.name));
      for(const from of left) for(const to of right){
        const candidateScore=score(base.n-from.count+to.count,base.v-from.value+to.value);
        if(better(candidateScore,bestCandidateScore)){
          bestCandidateScore=candidateScore;bestMove={from,to};
        }
      }
      if(!bestMove) break;
      best.delete(bestMove.from.name);best.add(bestMove.to.name);
    }
    // Inclusão/remoção de um grupo pode melhorar valores quando trocas não conseguem.
    for (let pass=0; pass<20; pass++) {
      const base=current();
      let move=null, next=score(base.n,base.v);
      for (const g of candidates) {
        const selectedNow=best.has(g.name);
        const candidateScore=score(base.n+(selectedNow?-g.count:g.count),base.v+(selectedNow?-g.value:g.value));
        if (better(candidateScore,next)) {next=candidateScore;move=g;}
      }
      if (!move) break;
      if (best.has(move.name)) best.delete(move.name); else best.add(move.name);
    }
    for (const g of touched) {
      const assigned=g.owner || (best.has(g.name)?'Flávio':'Ana');
      g.rows.forEach(r => r['Sorteado Para']=assigned);
    }
    return selected.length;
  }
  root.FSPReclamadaRules = Object.freeze({key, validate:rows=>units(rows), assign});
})(typeof window === 'undefined' ? globalThis : window);
