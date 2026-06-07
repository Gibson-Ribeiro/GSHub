(function(){
  const KEYS={
    pedidos:"pedidos",
    comandas:"comandas",
    configuracaoAtendimento:"configuracaoAtendimento",
    mesas:"mesas"
  };
  const STATUS=["Novo","Em preparo","Pronto","Entregue","Cancelado"];
  const CONFIG_PADRAO={modo:"cardapio",atualizadoEm:null};
  const COMANDAS_PADRAO={ultimoNumero:0,registros:[]};
  const CATEGORIAS_BAR=["drink","drinks","bebida","bebidas","nao alcoolico","nao alcoolica","cerveja","cervejas"];
  const CATEGORIAS_COZINHA=["prato","pratos","porcao","porcoes","sobremesa","sobremesas","lanche","lanches"];

  function ler(key,fallback){
    try{
      const raw=localStorage.getItem(key);
      if(!raw)return clonar(fallback);
      const parsed=JSON.parse(raw);
      return parsed??clonar(fallback);
    }catch{
      return clonar(fallback);
    }
  }
  function gravar(key,value){
    localStorage.setItem(key,JSON.stringify(value));
  }
  function clonar(value){
    return JSON.parse(JSON.stringify(value));
  }
  function gerarId(prefixo="id"){
    return prefixo+"_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  }
  function normalizarTexto(v){
    return String(v||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  }
  function normalizarMesa(v){
    const raw=String(v||"").trim();
    if(!raw)return "";
    const n=Number(raw);
    return Number.isFinite(n)&&n>0?String(n).padStart(2,"0"):raw;
  }
  function normalizarModoAtendimento(v){
    return v==="pedidos"?"pedidos":"cardapio";
  }
  function normalizarSetorPreparo(v){
    v=normalizarTexto(v);
    if(["bar","cozinha","ambos"].includes(v))return v;
    return "auto";
  }
  function setorDoProduto(produto={}){
    const setor=normalizarSetorPreparo(produto.setorPreparo);
    if(setor!=="auto")return setor;
    const categoria=normalizarTexto(produto.categoria);
    if(CATEGORIAS_BAR.includes(categoria))return "bar";
    if(CATEGORIAS_COZINHA.includes(categoria))return "cozinha";
    return "cozinha";
  }
  function itemPertenceAoSetor(item,setor,produto){
    if(!setor||setor==="geral")return true;
    const setorItem=normalizarSetorPreparo(item?.setorPreparo);
    const setorFinal=setorItem==="auto"?setorDoProduto(produto||item):setorItem;
    return setorFinal==="ambos"||setorFinal===setor;
  }
  function carregarPedidos(){
    const pedidos=ler(KEYS.pedidos,[]);
    return Array.isArray(pedidos)?pedidos:[];
  }
  function salvarPedidos(pedidos){
    const lista=Array.isArray(pedidos)?pedidos:[];
    gravar(KEYS.pedidos,lista);
    if(window.CapivarasData?.isSupabaseConfigured?.())CapivarasData.salvarNoSupabase("pedidos",lista).catch(()=>{});
  }
  function carregarComandas(){
    const comandas=ler(KEYS.comandas,COMANDAS_PADRAO);
    return {
      ultimoNumero:Number(comandas.ultimoNumero||0),
      registros:Array.isArray(comandas.registros)?comandas.registros:[]
    };
  }
  function salvarComandas(comandas){
    const dados={
      ultimoNumero:Number(comandas?.ultimoNumero||0),
      registros:Array.isArray(comandas?.registros)?comandas.registros:[]
    };
    gravar(KEYS.comandas,dados);
    if(window.CapivarasData?.isSupabaseConfigured?.())CapivarasData.salvarNoSupabase("comandas",[{id:"controle",...dados}]).catch(()=>{});
  }
  function carregarConfiguracao(){
    const config=ler(KEYS.configuracaoAtendimento,CONFIG_PADRAO);
    return {...CONFIG_PADRAO,...config,modo:normalizarModoAtendimento(config.modo)};
  }
  function salvarConfiguracao(config){
    const dados={...CONFIG_PADRAO,...config,modo:normalizarModoAtendimento(config?.modo),atualizadoEm:new Date().toISOString()};
    gravar(KEYS.configuracaoAtendimento,dados);
    if(window.CapivarasData?.isSupabaseConfigured?.())CapivarasData.salvarConfiguracaoAtendimento(dados).catch(()=>{});
  }
  function carregarMesas(){
    const mesas=ler(KEYS.mesas,[]);
    return Array.isArray(mesas)?mesas.map(m=>({...m,numero:normalizarMesa(m.numero)})).filter(m=>m.numero):[];
  }
  function salvarMesas(mesas){
    const lista=Array.isArray(mesas)?mesas:[];
    gravar(KEYS.mesas,lista);
    if(window.CapivarasData?.isSupabaseConfigured?.())CapivarasData.salvarNoSupabase("mesas",lista).catch(()=>{});
  }
  function proximoNumeroPedido(){
    const comandas=carregarComandas();
    comandas.ultimoNumero=Number(comandas.ultimoNumero||0)+1;
    salvarComandas(comandas);
    return String(comandas.ultimoNumero).padStart(4,"0");
  }
  function registrarComanda(pedido){
    const comandas=carregarComandas();
    comandas.registros=[
      {numero:pedido.numero,pedidoId:pedido.id,mesa:pedido.mesa,criadoEm:pedido.criadoEm},
      ...comandas.registros.filter(r=>r.pedidoId!==pedido.id)
    ].slice(0,500);
    salvarComandas(comandas);
  }
  function criarPedido(dados){
    const agora=new Date().toISOString();
    const numero=proximoNumeroPedido();
    const pedido={
      id:gerarId("ped"),
      numero,
      mesa:normalizarMesa(dados?.mesa),
      nomeCliente:String(dados?.nomeCliente||"").trim(),
      observacao:String(dados?.observacao||"").trim(),
      tipoCobranca:dados?.tipoCobranca==="comanda"?"comanda":"pagar_entrega",
      itens:Array.isArray(dados?.itens)?dados.itens:[],
      total:Number(dados?.total||0),
      status:"Novo",
      criadoEm:agora,
      atualizadoEm:agora
    };
    const pedidos=[pedido,...carregarPedidos()];
    salvarPedidos(pedidos);
    registrarComanda(pedido);
    return pedido;
  }
  function atualizarStatusPedido(id,status){
    if(!STATUS.includes(status))return null;
    let atualizado=null;
    const pedidos=carregarPedidos().map(p=>{
      if(p.id!==id)return p;
      atualizado={...p,status,atualizadoEm:new Date().toISOString()};
      if(status==="Em preparo"&&!atualizado.aceitoEm)atualizado.aceitoEm=atualizado.atualizadoEm;
      if(status==="Pronto")atualizado.prontoEm=atualizado.atualizadoEm;
      if(status==="Entregue")atualizado.entregueEm=atualizado.atualizadoEm;
      if(status==="Cancelado")atualizado.canceladoEm=atualizado.atualizadoEm;
      return atualizado;
    });
    salvarPedidos(pedidos);
    return atualizado;
  }
  function removerTudo(){
    Object.values(KEYS).forEach(key=>localStorage.removeItem(key));
  }
  function inicializar(){
    if(!localStorage.getItem(KEYS.pedidos))gravar(KEYS.pedidos,[]);
    if(!localStorage.getItem(KEYS.comandas))gravar(KEYS.comandas,COMANDAS_PADRAO);
    if(!localStorage.getItem(KEYS.configuracaoAtendimento))gravar(KEYS.configuracaoAtendimento,CONFIG_PADRAO);
    if(!localStorage.getItem(KEYS.mesas))gravar(KEYS.mesas,[]);
  }

  window.AtendimentoStore={
    keys:KEYS,
    status:STATUS,
    categoriasBar:CATEGORIAS_BAR,
    categoriasCozinha:CATEGORIAS_COZINHA,
    carregarPedidos,
    salvarPedidos,
    criarPedido,
    atualizarStatusPedido,
    carregarComandas,
    salvarComandas,
    carregarConfiguracao,
    salvarConfiguracao,
    carregarMesas,
    salvarMesas,
    inicializar,
    removerTudo,
    normalizarMesa,
    normalizarTexto,
    normalizarSetorPreparo,
    setorDoProduto,
    itemPertenceAoSetor
  };
  inicializar();
})();
