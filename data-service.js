(function(){
  const STORAGE_KEY="capivaras_ficha_tecnica_v2";
  const ORDER_KEYS={
    pedidos:"pedidos",
    comandas:"comandas",
    configuracaoAtendimento:"configuracaoAtendimento",
    mesas:"mesas"
  };
  const TABLES=["ingredientes","custos_fixos","receitas","produtos_cardapio","pedidos","comandas","mesas","configuracoes"];
  let client=null;
  let saveTimer=null;

  function configured(){
    return !!(window.SUPABASE_URL&&window.SUPABASE_ANON_KEY&&window.supabase?.createClient);
  }
  function getClient(){
    if(!configured())return null;
    if(!client)client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
    return client;
  }
  function clone(value){
    return JSON.parse(JSON.stringify(value));
  }
  function lerLocal(key,fallback){
    try{
      const raw=localStorage.getItem(key);
      return raw?JSON.parse(raw):clone(fallback);
    }catch{
      return clone(fallback);
    }
  }
  function salvarLocal(key,value){
    localStorage.setItem(key,JSON.stringify(value));
  }
  function rowToData(row){
    return row?.data&&typeof row.data==="object"?{...row.data,id:row.data.id||row.id}:{...row};
  }
  function dataToRow(item,index=0){
    const id=String(item?.id||item?.numero||item?.key||`item_${index}`);
    return {id,data:{...item,id},updated_at:new Date().toISOString()};
  }
  async function carregarTabela(table){
    const supa=getClient();
    if(!supa)return [];
    const {data,error}=await supa.from(table).select("*");
    if(error)throw error;
    return (data||[]).map(rowToData);
  }
  async function salvarNoSupabase(table,items){
    const supa=getClient();
    if(!supa||!TABLES.includes(table))return {ok:false,fallback:true};
    const lista=Array.isArray(items)?items:[items];
    const rows=lista.map(dataToRow);
    if(!rows.length)return {ok:true};
    const {error}=await supa.from(table).upsert(rows,{onConflict:"id"});
    if(error)throw error;
    return {ok:true};
  }
  async function buscarConfiguracao(id){
    const supa=getClient();
    if(!supa)return null;
    const {data,error}=await supa.from("configuracoes").select("*").eq("id",id).maybeSingle();
    if(error)throw error;
    return data?rowToData(data):null;
  }
  async function salvarConfiguracao(id,data){
    const supa=getClient();
    if(!supa)return {ok:false,fallback:true};
    const {error}=await supa.from("configuracoes").upsert({id,data:{...data,id},updated_at:new Date().toISOString()},{onConflict:"id"});
    if(error)throw error;
    return {ok:true};
  }
  function carregarLocal(fallbackState){
    return lerLocal(STORAGE_KEY,fallbackState);
  }
  async function carregarDoSupabase(fallbackState){
    const supa=getClient();
    if(!supa)return carregarLocal(fallbackState);
    const [
      ingredientes,
      custos,
      receitas,
      pedidos,
      comandasRows,
      mesas,
      stateConfig,
      atendimentoConfig
    ]=await Promise.all([
      carregarTabela("ingredientes").catch(()=>[]),
      carregarTabela("custos_fixos").catch(()=>[]),
      carregarTabela("receitas").catch(()=>[]),
      carregarTabela("pedidos").catch(()=>[]),
      carregarTabela("comandas").catch(()=>[]),
      carregarTabela("mesas").catch(()=>[]),
      buscarConfiguracao("state_config").catch(()=>null),
      buscarConfiguracao("atendimento").catch(()=>null)
    ]);
    const local=carregarLocal(fallbackState);
    const state={
      ingredientes:ingredientes.length?ingredientes:(local.ingredientes||[]),
      custos:custos.length?custos:(local.custos||[]),
      receitas:receitas.length?receitas:(local.receitas||[]),
      config:stateConfig||local.config||{}
    };
    salvarLocal(STORAGE_KEY,state);
    if(pedidos.length)salvarLocal(ORDER_KEYS.pedidos,pedidos);
    if(comandasRows.length)salvarLocal(ORDER_KEYS.comandas,comandasRows.find(c=>c.id==="controle")||{ultimoNumero:0,registros:comandasRows});
    if(mesas.length)salvarLocal(ORDER_KEYS.mesas,mesas);
    if(atendimentoConfig)salvarLocal(ORDER_KEYS.configuracaoAtendimento,atendimentoConfig);
    return state;
  }
  async function salvarTudoNoSupabase(state){
    if(!getClient())return;
    await Promise.all([
      salvarNoSupabase("ingredientes",state.ingredientes||[]),
      salvarNoSupabase("custos_fixos",state.custos||[]),
      salvarNoSupabase("receitas",state.receitas||[]),
      salvarConfiguracao("state_config",state.config||{})
    ]);
  }
  function salvarDados(state){
    salvarLocal(STORAGE_KEY,state);
    if(!getClient())return Promise.resolve({ok:true,fallback:true});
    clearTimeout(saveTimer);
    return new Promise(resolve=>{
      saveTimer=setTimeout(()=>salvarTudoNoSupabase(state).then(()=>resolve({ok:true})).catch(error=>resolve({ok:false,error})),600);
    });
  }
  async function carregarDados(fallbackState){
    if(!getClient())return carregarLocal(fallbackState);
    return carregarDoSupabase(fallbackState).catch(()=>carregarLocal(fallbackState));
  }
  async function salvarCardapioPublico(receitas){
    return salvarNoSupabase("produtos_cardapio",receitas||[]);
  }
  async function carregarCardapioPublico(){
    if(!getClient())return {receitas:[]};
    const receitas=await carregarTabela("produtos_cardapio").catch(()=>[]);
    return {receitas};
  }
  async function sincronizarPublicoLocal(){
    if(!getClient())return;
    const [atendimento,cardapio]=await Promise.all([
      buscarConfiguracao("atendimento").catch(()=>null),
      carregarCardapioPublico().catch(()=>({receitas:[]}))
    ]);
    if(atendimento)salvarLocal(ORDER_KEYS.configuracaoAtendimento,atendimento);
    if(cardapio.receitas?.length)salvarLocal("capivaras_cardapio_supabase_cache",cardapio);
  }
  async function signIn(email,password){
    const supa=getClient();
    if(!supa)throw new Error("Supabase não configurado.");
    const {data,error}=await supa.auth.signInWithPassword({email,password});
    if(error)throw error;
    return data;
  }
  async function signOut(){
    const supa=getClient();
    if(!supa)return;
    await supa.auth.signOut();
  }
  async function resetPassword(email,redirectTo){
    const supa=getClient();
    if(!supa)throw new Error("Supabase não configurado.");
    const {data,error}=await supa.auth.resetPasswordForEmail(email,{redirectTo});
    if(error)throw error;
    return data;
  }
  async function updatePassword(password){
    const supa=getClient();
    if(!supa)throw new Error("Supabase não configurado.");
    const {data,error}=await supa.auth.updateUser({password});
    if(error)throw error;
    return data;
  }
  async function exchangeCodeForSession(code){
    const supa=getClient();
    if(!supa||!code)return null;
    const {data,error}=await supa.auth.exchangeCodeForSession(code);
    if(error)throw error;
    return data;
  }
  async function getSession(){
    const supa=getClient();
    if(!supa)return null;
    const {data}=await supa.auth.getSession();
    return data?.session||null;
  }
  async function carregarPerfilUsuario(user){
    const supa=getClient();
    if(!supa||!user)return null;
    const {data,error}=await supa.from("profiles").select("*").eq("user_id",user.id).eq("ativo",true).maybeSingle();
    if(error)throw error;
    return data;
  }
  async function salvarConfiguracaoAtendimento(config){
    salvarLocal(ORDER_KEYS.configuracaoAtendimento,config);
    return salvarConfiguracao("atendimento",config);
  }

  window.CapivarasData={
    isSupabaseConfigured:configured,
    getClient,
    carregarDados,
    salvarDados,
    carregarDoSupabase,
    salvarNoSupabase,
    salvarConfiguracao,
    salvarConfiguracaoAtendimento,
    carregarCardapioPublico,
    salvarCardapioPublico,
    sincronizarPublicoLocal,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    exchangeCodeForSession,
    getSession,
    carregarPerfilUsuario
  };
})();
