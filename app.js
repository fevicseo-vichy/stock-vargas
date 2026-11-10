/* Buscador de stock EN VIVO — lee products.json de Shopify al cargar.
   Configuración por tienda en window.STORE (ver cada .html). */
(function () {
  "use strict";
  var S = window.STORE || {};
  var IVA = 0.19;
  var PROXIES = [
    "", // directo (Shopify envía Access-Control-Allow-Origin: *)
    "https://corsproxy.io/?url=", // respaldo 1
    "https://api.allorigins.win/raw?url=" // respaldo 2
  ];

  // ---- utilidades ----
  function stripAcc(s){return (s||"").normalize("NFD").replace(/[̀-ͯ]/g,"");}
  function norm(s){return stripAcc((s||"").toLowerCase());}
  function titlecase(s){return (s||"").split(" ").filter(Boolean).map(function(w){return w.charAt(0).toUpperCase()+w.slice(1).toLowerCase();}).join(" ");}
  function clp(n){return "$"+(n||0).toLocaleString("es-CL");}
  function esc(s){return (s||"").replace(/[&<>"]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]);});}

  var BRAND_KW = [
    ["Liqui Moly","liqui moly"],["Full Manager","full manager"],["New Car","new car"],["S-OIL","s-oil"],
    ["Bosch","bosch"],["Continental","continental"],["Delphi","delphi"],["Denso","denso"],
    ["Eurorepar","eurorepar"],["Gentry","gentry"],["Kendall","kendall"],["Kessel","kessel"],
    ["Lubrax","lubrax"],["Mann","mann"],["Mobis","mobis"],["NGK","ngk"],["Optimus","optimus"],
    ["Osram","osram"],["Shell","shell"],["Total","total"],["Williams","williams"],
    ["Würth","wurth"],["ZIC","zic"],["Valeo","valeo"]
  ];
  function marcaFromTitle(t){var nt=norm(t);for(var i=0;i<BRAND_KW.length;i++){if(nt.indexOf(BRAND_KW[i][1])>=0)return BRAND_KW[i][0];}return "Genérico / Otro";}
  function marcaFromVendor(v){v=(v||"").trim();if(!v||["GENERICO","GENÉRICO","GENERICO / OTRO","GENÉRICO / OTRO"].indexOf(v.toUpperCase())>=0)return "Genérico / Otro";return titlecase(v);}
  function thumb(src){if(!src)return "";return src.indexOf("?")>=0?src+"&width=240":src+"?width=240";}

  // ---- fetch con respaldo de proxy ----
  function getJSON(url){
    var i=0;
    function tryNext(){
      var pfx=PROXIES[i];
      var full=pfx?pfx+encodeURIComponent(url):url;
      return fetch(full,{headers:{"Accept":"application/json"}}).then(function(r){
        if(!r.ok)throw new Error("HTTP "+r.status);
        return r.json();
      }).catch(function(e){
        i++;
        if(i<PROXIES.length)return tryNext();
        throw e;
      });
    }
    return tryNext();
  }

  function fetchAll(){
    var all=[];
    function page(p){
      var url="https://www."+S.dom+"/products.json?limit=250&page="+p;
      return getJSON(url).then(function(j){
        var ps=(j&&j.products)||[];
        all=all.concat(ps);
        setStatus("Cargando… "+all.length+" productos");
        if(ps.length===250 && p<30)return page(p+1);
        return all;
      });
    }
    return page(1);
  }

  // ---- construir registros ----
  function build(raw){
    return raw.map(function(p){
      var vs=p.variants&&p.variants.length?p.variants:[{}];
      var v0=vs[0];
      var price=Math.round(parseFloat(v0.price||0))||0;
      var cp=null, cav=parseFloat(v0.compare_at_price||0);
      if(cav && cav>price)cp=Math.round(cav);
      var av=vs.some(function(x){return !!x.available;});
      var sku=(v0.sku||"").trim();
      var title=(p.title||"").trim();
      var marca=S.marca==="vendor"?marcaFromVendor(p.vendor):marcaFromTitle(title);
      var pt=(p.product_type||"").trim();
      var tipo=pt?titlecase(pt):"Otros";
      var imgs=p.images||[];
      var src=imgs.length&&imgs[0].src?imgs[0].src:"";
      return {c:sku,n:title,m:marca,t:tipo,p:price,av:av,cp:cp,
        u:"https://www."+S.dom+"/products/"+(p.handle||""), img:thumb(src)};
    });
  }

  // ---- estado + render ----
  var DATA=[], state={q:"",tipo:"",marca:"",stock:"",code:"",view:"card",limit:60};

  function uniq(arr){var o={};arr.forEach(function(x){if(x)o[x]=1;});return Object.keys(o).sort(function(a,b){return a.localeCompare(b,"es");});}

  function filtered(){
    var q=norm(state.q);
    return DATA.filter(function(p){
      if(state.tipo && p.t!==state.tipo)return false;
      if(state.marca && p.m!==state.marca)return false;
      if(state.stock==="ok" && !p.av)return false;
      if(state.stock==="no" && p.av)return false;
      if(state.code==="with" && !p.c)return false;
      if(state.code==="without" && p.c)return false;
      if(q){var hay=norm(p.n)+" "+norm(p.c)+" "+norm(p.m);if(hay.indexOf(q)<0)return false;}
      return true;
    });
  }

  function setStatus(t){var e=document.getElementById("status");if(e)e.textContent=t;}

  function kpiTile(val,label,f,show){
    var cls="kpi"+(f?" clk":"")+(show===false?" hide":"");
    return '<div class="'+cls+'"'+(f?' data-f="'+f+'" role="button" tabindex="0"':'')+'>'+
      '<div class="v">'+val+'</div><div class="l">'+label+'</div></div>';
  }

  function renderKPIs(){
    var n=DATA.length;
    var ok=DATA.filter(function(p){return p.av;}).length;
    var noc=DATA.filter(function(p){return !p.c;}).length;
    var val=DATA.reduce(function(a,p){return a+(p.av?p.p:0);},0);
    document.getElementById("kpis").innerHTML=
      kpiTile(n,"Productos","all",true)+
      kpiTile(ok,"En stock","ok",true)+
      kpiTile(n-ok,"Sin stock","no",true)+
      kpiTile(noc,"Sin código","without",noc>0)+
      kpiTile(clp(val),"Valor catálogo (neto)",null,true);
  }

  function renderFilters(){
    var tipos=uniq(DATA.map(function(p){return p.t;}));
    var marcas=uniq(DATA.map(function(p){return p.m;}));
    function opts(arr){return '<option value="">Todas</option>'+arr.map(function(x){return '<option value="'+esc(x)+'">'+esc(x)+'</option>';}).join("");}
    document.getElementById("f-tipo").innerHTML='<option value="">Todos los tipos</option>'+tipos.map(function(x){return '<option value="'+esc(x)+'">'+esc(x)+'</option>';}).join("");
    document.getElementById("f-marca").innerHTML='<option value="">Todas las marcas</option>'+marcas.map(function(x){return '<option value="'+esc(x)+'">'+esc(x)+'</option>';}).join("");
  }

  function card(p){
    var iva=Math.round(p.p*(1+IVA));
    var badge=p.cp?'<span class="of">OFERTA</span>':'';
    var was=p.cp?'<span class="was">'+clp(p.cp)+'</span>':'';
    var stk=p.av?'<span class="st ok">● En stock</span>':'<span class="st no">● Sin stock</span>';
    var img=p.img?'<img loading="lazy" src="'+esc(p.img)+'" alt="">':'<div class="noimg">Sin imagen</div>';
    return '<div class="card">'+badge+'<div class="ph">'+img+'</div>'+
      '<div class="cb"><div class="cn">'+esc(p.n)+'</div>'+
      '<div class="meta"><span class="cod">'+(p.c?esc(p.c):'<i>sin código</i>')+'</span> · '+esc(p.m)+'</div>'+
      '<div class="tipo">'+esc(p.t)+'</div>'+
      '<div class="pr">'+clp(p.p)+' <small>neto</small> '+was+'</div>'+
      '<div class="pi">'+clp(iva)+' <small>c/IVA</small></div>'+
      stk+' <a class="ver" href="'+esc(p.u)+'" target="_blank" rel="noopener">Ver en la web ↗</a>'+
      '</div></div>';
  }

  function row(p){
    var iva=Math.round(p.p*(1+IVA));
    return '<tr><td>'+(p.c?esc(p.c):'—')+'</td><td>'+esc(p.n)+'</td><td>'+esc(p.m)+'</td><td>'+esc(p.t)+'</td>'+
      '<td class="r">'+clp(p.p)+'</td><td class="r">'+clp(iva)+'</td>'+
      '<td>'+(p.av?'<span class="st ok">En stock</span>':'<span class="st no">Sin stock</span>')+'</td>'+
      '<td><a href="'+esc(p.u)+'" target="_blank" rel="noopener">Ver ↗</a></td></tr>';
  }

  function render(){
    var r=filtered();
    setStatus(r.length+" de "+DATA.length+" productos");
    var box=document.getElementById("results");
    var shown=r.slice(0,state.limit);
    if(!r.length){box.innerHTML='<div class="empty">Sin resultados. Prueba otra búsqueda o filtro.</div>';}
    else if(state.view==="table"){
      box.innerHTML='<div class="tbw"><table><thead><tr><th>Código</th><th>Producto</th><th>Marca</th><th>Tipo</th><th class="r">Neto</th><th class="r">c/IVA</th><th>Stock</th><th></th></tr></thead><tbody>'+shown.map(row).join("")+'</tbody></table></div>';
    } else {
      box.innerHTML='<div class="grid">'+shown.map(card).join("")+'</div>';
    }
    var more=document.getElementById("more");
    if(r.length>state.limit){more.style.display="";more.textContent="Mostrar más ("+(r.length-state.limit)+" restantes)";}
    else more.style.display="none";
    // marcar KPI activo
    Array.prototype.forEach.call(document.querySelectorAll("#kpis .kpi"),function(k){k.classList.remove("active");});
    var af=state.stock==="ok"?"ok":state.stock==="no"?"no":state.code==="without"?"without":(!state.tipo&&!state.marca&&!state.stock&&!state.code&&!state.q)?"all":null;
    if(af){var el=document.querySelector('#kpis [data-f="'+af+'"]');if(el)el.classList.add("active");}
  }

  function wire(){
    document.getElementById("q").addEventListener("input",function(e){state.q=e.target.value;state.limit=60;render();});
    document.getElementById("f-tipo").addEventListener("change",function(e){state.tipo=e.target.value;state.limit=60;render();});
    document.getElementById("f-marca").addEventListener("change",function(e){state.marca=e.target.value;state.limit=60;render();});
    document.getElementById("f-stock").addEventListener("change",function(e){state.stock=e.target.value;state.limit=60;render();});
    document.getElementById("f-code").addEventListener("change",function(e){state.code=e.target.value;state.limit=60;render();});
    document.getElementById("more").addEventListener("click",function(){state.limit+=60;render();});
    var vc=document.getElementById("v-card"),vt=document.getElementById("v-table");
    vc.addEventListener("click",function(){state.view="card";vc.classList.add("on");vt.classList.remove("on");render();});
    vt.addEventListener("click",function(){state.view="table";vt.classList.add("on");vc.classList.remove("on");render();});
    var kb=document.getElementById("kpis");
    function go(f){
      if(f==="all"){state.stock="";state.code="";state.tipo="";state.marca="";state.q="";document.getElementById("q").value="";document.getElementById("f-tipo").value="";document.getElementById("f-marca").value="";document.getElementById("f-stock").value="";document.getElementById("f-code").value="";}
      else if(f==="ok"||f==="no"){state.stock=f;document.getElementById("f-stock").value=f;state.code="";document.getElementById("f-code").value="";}
      else if(f==="without"){state.code="without";document.getElementById("f-code").value="without";state.stock="";document.getElementById("f-stock").value="";}
      state.limit=60;render();
      var tb=document.querySelector(".toolbar");if(tb&&tb.scrollIntoView)tb.scrollIntoView({behavior:"smooth",block:"start"});
    }
    kb.addEventListener("click",function(e){var t=e.target.closest&&e.target.closest("[data-f]");if(t)go(t.getAttribute("data-f"));});
    kb.addEventListener("keydown",function(e){if(e.key!=="Enter"&&e.key!==" ")return;var t=e.target.closest&&e.target.closest("[data-f]");if(t){e.preventDefault();go(t.getAttribute("data-f"));}});
  }

  function fail(e){
    setStatus("");
    document.getElementById("results").innerHTML='<div class="empty err">No se pudo cargar el catálogo de <b>'+esc(S.tienda)+'</b>.<br><small>'+esc(String(e&&e.message||e))+'</small><br><br>Reintenta en unos minutos (puede ser límite temporal de Shopify) o avísanos.</div>';
    var b=document.getElementById("reload");if(b)b.style.display="";
  }

  function boot(){
    document.title="Stock "+S.tienda;
    var ttl=document.getElementById("tienda");if(ttl)ttl.textContent=S.tienda;
    var upd=document.getElementById("upd");if(upd)upd.textContent="Actualizado: "+new Date().toLocaleString("es-CL",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
    setStatus("Cargando catálogo…");
    fetchAll().then(function(raw){
      DATA=build(raw);
      renderKPIs();renderFilters();wire();render();
    }).catch(fail);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
