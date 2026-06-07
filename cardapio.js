const STORAGE_KEY="capivaras_ficha_tecnica_v2";
const MARKUP=3;
let cardapio={receitas:[]};
let categoriaAtual="";
let configuracaoAtendimento={modo:"cardapio"};
let mesaAtual="";
let carrinho=[];
const $=s=>document.querySelector(s);

document.addEventListener("DOMContentLoaded",async()=>{
  if(window.CapivarasData?.isSupabaseConfigured?.())await CapivarasData.sincronizarPublicoLocal().catch(()=>{});
  configuracaoAtendimento=AtendimentoStore.carregarConfiguracao();
  mesaAtual=AtendimentoStore.normalizarMesa(new URLSearchParams(location.search).get("mesa"));
  cardapio=await carregarCardapio();
  configurarEventosPedido();
  renderModoAtendimento();
  renderFiltros();
  renderCardapio();
  renderCarrinho();
});

async function carregarCardapio(){
  if(window.CapivarasData?.isSupabaseConfigured?.()){
    const remoto=await CapivarasData.carregarCardapioPublico().catch(()=>({receitas:[]}));
    if(remoto.receitas?.length)return{...remoto,receitas:remoto.receitas.map(normalizarProdutoCardapio)};
    const cache=localStorage.getItem("capivaras_cardapio_supabase_cache");
    if(cache){
      try{
        const json=JSON.parse(cache);
        if(Array.isArray(json.receitas)&&json.receitas.length)return{...json,receitas:json.receitas.map(normalizarProdutoCardapio)};
      }catch{}
    }
  }
  const local=localStorage.getItem(STORAGE_KEY);
  if(local){
    try{
      const state=JSON.parse(local);
      const dados=montarDeState(state);
      if(dados.receitas.length)return dados;
    }catch{}
  }
  try{
    const resp=await fetch("cardapio-data.json",{cache:"no-store"});
    if(resp.ok){
      const json=await resp.json();
      if(Array.isArray(json.receitas))return{...json,receitas:json.receitas.map(normalizarProdutoCardapio)};
    }
  }catch{}
  return{receitas:[]};
}
function montarDeState(state){
  state=state||{};
  const ingredientes=Array.isArray(state.ingredientes)?state.ingredientes:[];
  const custos=Array.isArray(state.custos)?state.custos:[];
  const config=state.config||{};
  const totalCustos=custos.reduce((a,c)=>a+Number(c.valorMensal||0),0);
  const custoMin=Number(config.horasProdutivasMes||0)>0?totalCustos/(Number(config.horasProdutivasMes)*60):0;
  function unidadeBase(u){u=String(u||"").toLowerCase();if(["kg","g","gr","gramas"].includes(u))return"g";if(["litro","l","ml"].includes(u))return"ml";return"unidade";}
  function qtdBase(q,u){u=String(u||"").toLowerCase();q=Number(q)||0;if(u==="kg"||u==="litro"||u==="l")return q*1000;return q;}
  function custoUnit(i){const base=qtdBase(i.quantidade,i.unidadeCompra);return base>0?Number(i.custoTotal||0)/base:0;}
  function tempo(v){if(typeof v==="number")return v;return Number(String(v||"").replace(",",".").match(/[0-9.]+/)?.[0]||0);}
  function calc(r){let custo=0;(r.ingredientes||[]).forEach(it=>{const ing=ingredientes.find(i=>i.id===it.ingredienteId);if(!ing)return;custo+=custoUnit(ing)*Number(it.quantidade||0);});custo+=tempo(r.tempoPreparoMin??r.tempoPreparo)*custoMin;const bruto=custo*MARKUP;const arred=Math.ceil(bruto/0.5)*0.5;return Number(r.precoFinalManual||0)>0?Number(r.precoFinalManual):arred;}
  return{receitas:(state.receitas||[]).filter(r=>r.ativoCardapio).map(r=>normalizarProdutoCardapio({id:r.id,nome:r.nome,categoria:r.categoria||"Outro",setorPreparo:r.setorPreparo||"auto",descricaoCardapio:r.descricaoCardapio||"",ingredientes:[...new Set((r.ingredientes||[]).map(it=>ingredientes.find(i=>i.id===it.ingredienteId)?.nome).filter(Boolean))],precoFinal:calc(r),fotoProduto:r.fotoProduto||r.fotoUrl||""}))};
}
function normalizarProdutoCardapio(r){
  return{...r,categoria:r.categoria||"Outro",setorPreparo:AtendimentoStore.normalizarSetorPreparo(r.setorPreparo||"auto"),descricaoCardapio:r.descricaoCardapio||"",ingredientes:Array.isArray(r.ingredientes)?r.ingredientes:[],precoFinal:Number(r.precoFinal||0),fotoProduto:r.fotoProduto||""};
}
function moeda(v){return(Number(v)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
function seguro(v){const d=document.createElement("div");d.textContent=v??"";return d.innerHTML;}
function pedidosHabilitados(){return configuracaoAtendimento.modo==="pedidos"&&!!mesaAtual;}
function configurarEventosPedido(){
  $("#enviarPedido")?.addEventListener("click",enviarPedido);
  $("#carrinhoItens")?.addEventListener("click",e=>{
    const btn=e.target.closest("[data-cart-action]");
    if(!btn)return;
    const id=btn.dataset.id,action=btn.dataset.cartAction;
    if(action==="add")alterarQuantidade(id,1);
    if(action==="remove")alterarQuantidade(id,-1);
    if(action==="delete")removerDoCarrinho(id);
  });
}
function renderModoAtendimento(){
  const notice=$("#menuNotice"),banner=$("#pedidoModoInfo"),layout=$("#menuOrderLayout"),cart=$("#pedidoCarrinho");
  if(configuracaoAtendimento.modo!=="pedidos"){
    notice.innerHTML=`<strong>Faça seu pedido diretamente no balcão.</strong><p>Cardápio digital atualizado pelo Capivaras.</p>`;
    banner.classList.add("hidden");cart.classList.add("hidden");layout.classList.add("simple");return;
  }
  if(!mesaAtual){
    notice.innerHTML=`<strong>Faça seu pedido diretamente no balcão.</strong><p>Escaneie o QR Code da sua mesa para pedir pelo sistema.</p>`;
    banner.textContent="Para fazer pedido pelo cardápio, use o QR Code individual da mesa.";
    banner.classList.remove("hidden");cart.classList.add("hidden");layout.classList.add("simple");return;
  }
  notice.innerHTML=`<strong>Mesa ${seguro(mesaAtual)} identificada.</strong><p>Escolha os itens, informe seu nome e envie o pedido.</p>`;
  $("#pedidoMesaLabel").textContent=mesaAtual;
  banner.classList.add("hidden");cart.classList.remove("hidden");layout.classList.remove("simple");
}
function renderFiltros(){
  const cats=[...new Set(cardapio.receitas.map(r=>r.categoria||"Outro"))].sort();
  const nav=$("#menuFiltros");
  nav.innerHTML=`<button class="menu-filter active" data-cat="">Todos</button>`+cats.map(c=>`<button class="menu-filter" data-cat="${seguro(c)}">${seguro(c)}</button>`).join("");
  nav.querySelectorAll(".menu-filter").forEach(btn=>btn.addEventListener("click",()=>{categoriaAtual=btn.dataset.cat;nav.querySelectorAll(".menu-filter").forEach(b=>b.classList.remove("active"));btn.classList.add("active");renderCardapio();}));
}
function renderCardapio(){
  const lista=cardapio.receitas.filter(r=>!categoriaAtual||r.categoria===categoriaAtual);
  const box=$("#menuLista"),podePedir=pedidosHabilitados();
  if(!lista.length){box.innerHTML=`<div class="card menu-empty">Nenhum produto ativo no cardápio no momento.</div>`;return;}
  box.innerHTML=lista.map(r=>`<article class="card menu-item"><div class="menu-photo">${r.fotoProduto?`<img src="${r.fotoProduto}" alt="${seguro(r.nome)}" />`:"🍽️"}</div><div><div class="menu-category">${seguro(r.categoria)}</div><h2>${seguro(r.nome)}</h2><p class="menu-description">${seguro(r.descricaoCardapio||"Produto especial do Capivaras Feira & Bar.")}</p>${r.ingredientes?.length?`<p class="menu-ingredients"><strong>Ingredientes:</strong> ${r.ingredientes.map(seguro).join(", ")}</p>`:""}<div class="menu-price-row"><div class="menu-price">${moeda(r.precoFinal)}</div>${podePedir?`<button class="btn secondary menu-add-btn" type="button" data-add="${seguro(r.id)}">Adicionar</button>`:""}</div></div></article>`).join("");
  if(podePedir)box.querySelectorAll("[data-add]").forEach(btn=>btn.addEventListener("click",()=>adicionarAoCarrinho(btn.dataset.add)));
}
function adicionarAoCarrinho(id){
  const produto=cardapio.receitas.find(r=>r.id===id);
  if(!produto)return;
  const item=carrinho.find(i=>i.produtoId===id);
  if(item)item.quantidade+=1;
  else carrinho.push({produtoId:produto.id,nome:produto.nome,categoria:produto.categoria,setorPreparo:produto.setorPreparo,precoUnitario:Number(produto.precoFinal||0),quantidade:1});
  mostrarMensagemPedido("");
  renderCarrinho();
}
function alterarQuantidade(id,delta){
  const item=carrinho.find(i=>i.produtoId===id);
  if(!item)return;
  item.quantidade=Math.max(0,Number(item.quantidade||0)+delta);
  carrinho=carrinho.filter(i=>i.quantidade>0);
  renderCarrinho();
}
function removerDoCarrinho(id){carrinho=carrinho.filter(i=>i.produtoId!==id);renderCarrinho();}
function renderCarrinho(){
  if(!$("#pedidoCarrinho"))return;
  const total=carrinho.reduce((a,i)=>a+Number(i.precoUnitario||0)*Number(i.quantidade||0),0);
  const qtd=carrinho.reduce((a,i)=>a+Number(i.quantidade||0),0);
  $("#carrinhoContador").textContent=`${qtd} ${qtd===1?"item":"itens"}`;
  $("#carrinhoTotal").textContent=moeda(total);
  const box=$("#carrinhoItens");
  if(!carrinho.length){box.classList.add("empty-state");box.innerHTML="Seu carrinho está vazio.";return;}
  box.classList.remove("empty-state");
  box.innerHTML=carrinho.map(i=>`<div class="cart-item"><div><strong>${seguro(i.nome)}</strong><span>${moeda(i.precoUnitario)} cada</span></div><div class="cart-qty"><button type="button" data-cart-action="remove" data-id="${seguro(i.produtoId)}">−</button><strong>${i.quantidade}</strong><button type="button" data-cart-action="add" data-id="${seguro(i.produtoId)}">+</button><button type="button" data-cart-action="delete" data-id="${seguro(i.produtoId)}">×</button></div></div>`).join("");
}
function enviarPedido(){
  if(!pedidosHabilitados()){mostrarMensagemPedido("Pedidos pelo sistema estão indisponíveis para este QR Code.",true);return;}
  if(!carrinho.length){mostrarMensagemPedido("Adicione pelo menos um item ao carrinho.",true);return;}
  const nome=$("#pedidoClienteNome").value.trim();
  if(!nome){mostrarMensagemPedido("Informe seu nome para enviar o pedido.",true);$("#pedidoClienteNome").focus();return;}
  const itens=carrinho.map(i=>({...i,quantidade:Number(i.quantidade||0),subtotal:Number(i.precoUnitario||0)*Number(i.quantidade||0)}));
  const total=itens.reduce((a,i)=>a+i.subtotal,0);
  try{
    const pedido=AtendimentoStore.criarPedido({mesa:mesaAtual,nomeCliente:nome,observacao:$("#pedidoObservacao").value.trim(),tipoCobranca:$("#pedidoTipoCobranca").value,itens,total});
    carrinho=[];
    $("#pedidoObservacao").value="";
    renderCarrinho();
    mostrarMensagemPedido(`Pedido #${pedido.numero} enviado para a mesa ${pedido.mesa}. Status: Novo.`);
  }catch{
    mostrarMensagemPedido("Não foi possível salvar o pedido neste navegador.",true);
  }
}
function mostrarMensagemPedido(msg,erro=false){
  const box=$("#pedidoConfirmacao");
  if(!msg){box.classList.add("hidden");box.textContent="";return;}
  box.textContent=msg;
  box.classList.toggle("error",!!erro);
  box.classList.remove("hidden");
}
