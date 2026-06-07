(function(){
  let deferredPrompt=null;
  const INSTALL_TEXT=[
    "Android: abra no Chrome e toque em Adicionar à tela inicial.",
    "iPhone: abra no Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.",
    "Computador: use o botão de instalar do navegador quando ele aparecer."
  ].join("\n");

  function registrarServiceWorker(){
    if(!("serviceWorker" in navigator))return;
    const seguro=location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1";
    if(!seguro)return;
    window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
  }
  async function instalar(){
    if(deferredPrompt){
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(()=>null);
      deferredPrompt=null;
      return;
    }
    alert(INSTALL_TEXT);
  }
  function configurarBotoes(){
    document.querySelectorAll("[data-install-app]").forEach(btn=>btn.addEventListener("click",instalar));
    document.querySelectorAll("[data-install-instructions]").forEach(el=>{el.textContent=INSTALL_TEXT;});
  }

  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();
    deferredPrompt=event;
    document.querySelectorAll("[data-install-app]").forEach(btn=>btn.classList.remove("hidden"));
  });
  window.addEventListener("appinstalled",()=>{deferredPrompt=null;});
  document.addEventListener("DOMContentLoaded",configurarBotoes);
  registrarServiceWorker();
})();
