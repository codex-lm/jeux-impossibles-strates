/* Strates — continuous full-board camera. The original fixed-view edition is preserved. */
(function () {
  'use strict';
  var G = window.STRATES_ORBIT;
  var TAU = Math.PI * 2;
  function initialPose(player) { return { yaw: (player === 'C' ? 315 : 225) * Math.PI / 180, pitch: Math.PI / 6, zoom: 1 }; }
  var poses = { A: initialPose('A'), C: initialPose('C') };
  var gesture = null, suppressClick = false, lastDrag = -1000;
  var oldHUD = window.majHUD, oldNewGame = window.nouvellePartie, oldOnlineNew = window.relancerPartieEnLigne;
  function pose() { return poses[cameraActive()] || poses.A; }
  function canView() { return ['jeu', 'fin', 'attente', 'iaReflechi'].indexOf(S.phase) !== -1; }
  function modalOpen() { return !$('regles').classList.contains('cache'); }
  function labels() {
    var fr = LANG === 'fr';
    $('cameraControls').style.display = canView() ? '' : 'none';
    $('cameraControls').setAttribute('aria-label', fr ? 'Caméra du plateau' : 'Board camera');
    $('cameraReset').textContent = fr ? 'Recentrer' : 'Reset view';
    $('cameraReset').title = fr ? 'Vue initiale — touche Origine' : 'Initial view — Home key';
    $('cameraZoomOut').setAttribute('aria-label', fr ? 'Dézoomer' : 'Zoom out');
    $('cameraZoomIn').setAttribute('aria-label', fr ? 'Zoomer' : 'Zoom in');
    $('cameraHint').textContent = fr ? 'Glisser : tourner et incliner · Molette : zoom · Clic : jouer' : 'Drag: orbit and tilt · Wheel: zoom · Click: play';
    $('vueLigne').textContent = fr ? 'Vue libre — plateau entièrement partagé' : 'Free view — the full board is shared';
  }
  window.majHUD = function () { oldHUD(); $('btnVue').style.display='none'; labels(); };
  function changed() {
    var p = pose(); p.yaw = ((p.yaw % TAU) + TAU) % TAU;
    p.pitch = G.clamp(p.pitch, 0.22, 1.43); p.zoom = G.clamp(p.zoom, 0.6, 2.1);
    survol = null; souris.x = -1; souris.y = -1;
    labels(); redessiner();
  }
  function resetView() { poses[cameraActive()] = initialPose(cameraActive()); changed(); }
  function resetAll() { poses = { A: initialPose('A'), C: initialPose('C') }; gesture = null; suppressClick = false; }
  window.nouvellePartie = function () { resetAll(); oldNewGame(); };
  window.relancerPartieEnLigne = function () { resetAll(); oldOnlineNew(); };
  window.calculerLayout = function () {
    var W = window.innerWidth, H = window.innerHeight, p = pose();
    var top = Math.max(130, H * 0.17), bottom = Math.max(120, H * 0.15);
    if (W < 650) { top = Math.max(170, H * 0.2); bottom = 145; }
    var corners = [], xs = [-0.58, 3.58], zs = [-0.25, 4.05];
    xs.forEach(function (x) { xs.forEach(function (y) { zs.forEach(function (z) { corners.push(G.project([x,y,z], p, {scale:1,cx:0,cy:0,centerZ:1.2})); }); }); });
    var minX = Math.min.apply(null, corners.map(function (v) { return v.x; }));
    var maxX = Math.max.apply(null, corners.map(function (v) { return v.x; }));
    var minY = Math.min.apply(null, corners.map(function (v) { return v.y; }));
    var maxY = Math.max.apply(null, corners.map(function (v) { return v.y; }));
    var scale = Math.max(10, Math.min((W - 44) / (maxX-minX), Math.max(100,H-top-bottom) / (maxY-minY))) * 0.94 * p.zoom;
    var cx = W/2 - (minX+maxX)*scale/2, cy = (top+H-bottom)/2 - (minY+maxY)*scale/2;
    L = { W:W,H:H,scale:scale,cx:cx,cy:cy,centerZ:1.2,tw:scale/Math.sqrt(2),th:scale/Math.sqrt(8),ch:scale*Math.cos(p.pitch),ox:cx,oy:cy };
  };
  function project(x,y,z) { return G.project([x,y,z],pose(),L); }
  function floorPolygon(x,y,z,r) {
    return [[x-r,y-r,z],[x+r,y-r,z],[x+r,y+r,z],[x-r,y+r,z]].map(function (v) { return G.project(v,pose(),L); });
  }
  function shade(normal) { return normal[2] ? 0.13 : (normal[0] < 0 || normal[1] < 0 ? -0.18 : -0.34); }
  function paintFace(face) {
    var rgb = face.colour === 'A' ? '#6ec8ff' : '#ff9166';
    if (face.ghost) {
      ctx.save(); ctx.globalAlpha = 0.30; remplir(ctx,face.points,rgb); ctx.restore();
      ctx.save(); ctx.setLineDash([5*UIK,4*UIK]); tracer(ctx,face.points,rgb,ep(1.8)); ctx.restore();
    } else {
      var material = Assets.asset('strates/texture/' + (face.colour === 'A' ? 'azur' : 'corail'));
      if (material) {
        textureFace(ctx,material,face.points);
        remplir(ctx,face.points,face.normal[2] ? 'rgba(255,255,255,.12)' : 'rgba(20,13,30,'+(face.normal[0]<0 || face.normal[1]<0 ? '.18' : '.34')+')');
      } else remplir(ctx,face.points,melange(rgb,shade(face.normal)));
      tracer(ctx,face.points,'rgba(30,20,35,.7)',ep(1));
    }
    var selected = S.selection && S.selection.x===face.x && S.selection.y===face.y && S.selection.z===face.z;
    if (selected) tracer(ctx,face.points,'#fff3d9',ep(2.6));
    hits.push({poly:face.points,kind:face.ghost?'fantome':'cube',x:face.x,y:face.y,z:face.z,face:face.name==='top'?'haut':'laterale'});
  }
  window.dessinerPlateau = function () {
    hits.length=0;
    var cam=pose(), boardTop=[[-.52,-.52,0],[3.52,-.52,0],[3.52,3.52,0],[-.52,3.52,0]];
    var shadow=project(1.5,1.5,-.35);
    ctx.save(); ctx.fillStyle='rgba(5,4,12,.25)'; ctx.beginPath(); ctx.ellipse(shadow.x,shadow.y,L.scale*2.9,L.scale*(.55+Math.sin(cam.pitch)),0,0,TAU); ctx.fill(); ctx.restore();
    var edges=[{a:boardTop[0],b:boardTop[1],n:[0,-1,0]},{a:boardTop[1],b:boardTop[2],n:[1,0,0]},{a:boardTop[2],b:boardTop[3],n:[0,1,0]},{a:boardTop[3],b:boardTop[0],n:[-1,0,0]}];
    edges.forEach(function (edge) {
      var a=edge.a,b=edge.b;
      var face=G.face([[a[0],a[1],-.22],[b[0],b[1],-.22],b,a],edge.n,'base',cam,L);
      if (face) { remplir(ctx,face.points,melange('#ae7d59',shade(edge.n))); tracer(ctx,face.points,'rgba(55,32,45,.55)',ep(1)); }
    });
    remplir(ctx,boardTop.map(function(v){return G.project(v,cam,L);}), '#b58b63');
    var material=Assets.asset('strates/texture/neutre');
    for (var x=0;x<N;x++) for(var y=0;y<N;y++) {
      var pts=floorPolygon(x,y,0,.5);
      var hover=survol && survol.kind==='sol' && survol.x===x && survol.y===y && S.phase==='jeu';
      if(material) textureFace(ctx,material,pts); else remplir(ctx,pts,'#b58b63');
      if(hover) remplir(ctx,pts,'rgba(255,218,160,.3)');
      tracer(ctx,pts,'rgba(86,52,46,.55)',ep(1));
      hits.push({poly:pts,kind:'sol',x:x,y:y,z:0,face:'sol'});
    }
    COTES.forEach(function(side) {
      var a=project(side.a[0],side.a[1],.01), b=project(side.b[0],side.b[1],.01);
      ctx.save(); ctx.strokeStyle=JOUEURS[side.joueur].couleur; ctx.lineWidth=ep(2.2); ctx.shadowColor=ctx.strokeStyle; ctx.shadowBlur=6*UIK;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
    });
    var faces=[];
    for(var bx=0;bx<N;bx++) for(var by=0;by<N;by++) for(var z=0;z<S.grille[bx][by].length;z++) {
      var colour=S.grille[bx][by][z];
      if(colour!=='A' && colour!=='C') continue;
      G.cubeFaces(bx,by,z,cam,L).forEach(function(face) {face.x=bx;face.y=by;face.z=z;face.colour=colour;faces.push(face);});
    }
    S.dests.forEach(function(d) {
      G.cubeFaces(d.x,d.y,d.z,cam,L).forEach(function(face) {face.x=d.x;face.y=d.y;face.z=d.z;face.colour=S.joueur;face.ghost=true;faces.push(face);});
    });
    faces.sort(function(a,b){return a.depth-b.depth;});
    faces.forEach(paintFace);
    // Keep the public tomography overlay visible through higher stacks.
    if(S.scan) faces.filter(function(f){return !f.ghost && f.z===S.scan.z;}).forEach(function(f){
      ctx.save();ctx.setLineDash([4*UIK,4*UIK]);tracer(ctx,f.points,'rgba(255,240,210,.8)',ep(1.5));ctx.restore();
    });
    if(survol && survol.kind==='cube' && S.phase==='jeu') {
      var hovered=faces.filter(function(f){return !f.ghost && f.x===survol.x && f.y===survol.y && f.z===survol.z && (survol.face==='haut'?f.name==='top':f.name!=='top');});
      hovered.forEach(function(f){tracer(ctx,f.points,'rgba(255,242,216,.9)',ep(1.6));});
    }
    var center=project(1.5,1.5,0);
    ctx.save();ctx.font='600 '+Math.max(11,Math.round(L.scale*.16))+'px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';
    COTES.forEach(function(side,i){var m=project((side.a[0]+side.b[0])/2,(side.a[1]+side.b[1])/2,.02);var dx=m.x-center.x,dy=m.y-center.y,n=Math.hypot(dx,dy)||1;ctx.fillStyle=JOUEURS[side.joueur].couleur;ctx.fillText(labCote(i),m.x+dx/n*L.scale*.35,m.y+dy/n*L.scale*.35);});
    ctx.restore();
  };
  window.rendreMinimap = function () {
    mctx.clearRect(0,0,196,128);
    var mini={scale:22,cx:98,cy:64,centerZ:0}, camera={yaw:pose().yaw,pitch:.65};
    function point(x,y){return G.project([x,y,0],camera,mini);}
    for(var x=0;x<N;x++) for(var y=0;y<N;y++) {
      var pts=[[x-.5,y-.5],[x+.5,y-.5],[x+.5,y+.5],[x-.5,y+.5]].map(function(v){return point(v[0],v[1]);});
      remplir(mctx,pts,'rgba(45,26,35,.85)');tracer(mctx,pts,'rgba(243,229,208,.3)',1);
      var c=point(x,y),h=S.grille[x][y].length;
      mctx.fillStyle='rgba(255,240,214,.9)';mctx.font='11px Georgia,serif';mctx.textAlign='center';mctx.textBaseline='middle';mctx.fillText(h?String(h):'·',c.x,c.y);
    }
    COTES.forEach(function(side,i){var a=point(side.a[0],side.a[1]),b=point(side.b[0],side.b[1]);mctx.strokeStyle=JOUEURS[side.joueur].couleur;mctx.lineWidth=2;mctx.beginPath();mctx.moveTo(a.x,a.y);mctx.lineTo(b.x,b.y);mctx.stroke();var c=point((side.a[0]+side.b[0])/2,(side.a[1]+side.b[1])/2),dx=c.x-98,dy=c.y-64,n=Math.hypot(dx,dy)||1;mctx.fillStyle=JOUEURS[side.joueur].couleur;mctx.fillText(labCote(i),c.x+dx/n*13,c.y+dy/n*13);});
  };
  function finishGesture(ev,cancelled) {
    if(!gesture || (ev.pointerId!==undefined && ev.pointerId!==gesture.id)) return;
    var old=gesture;gesture=null;
    if(old.dragged || cancelled) {suppressClick=true;lastDrag=performance.now();}
    if(cv.hasPointerCapture && cv.hasPointerCapture(old.id)) cv.releasePointerCapture(old.id);
  }
  cv.style.touchAction='none';
  cv.addEventListener('pointerdown',function(ev){
    if(!canView() || modalOpen() || gesture || (ev.button!==0 && ev.button!==2)) return;
    suppressClick=false;
    gesture={id:ev.pointerId,x:ev.clientX,y:ev.clientY,lastX:ev.clientX,lastY:ev.clientY,dragged:false};
    cv.setPointerCapture(ev.pointerId);
  });
  cv.addEventListener('pointermove',function(ev){
    if(!gesture || gesture.id!==ev.pointerId) return;
    if(!gesture.dragged && Math.hypot(ev.clientX-gesture.x,ev.clientY-gesture.y)<6) return;
    gesture.dragged=true;ev.preventDefault();
    var p=pose();p.yaw-=(ev.clientX-gesture.lastX)*.007;p.pitch-=(ev.clientY-gesture.lastY)*.005;
    gesture.lastX=ev.clientX;gesture.lastY=ev.clientY;changed();
  });
  cv.addEventListener('pointerup',function(ev){finishGesture(ev,false);});
  cv.addEventListener('pointercancel',function(ev){finishGesture(ev,true);});
  cv.addEventListener('lostpointercapture',function(ev){finishGesture(ev,true);});
  cv.addEventListener('click',function(ev){if(suppressClick){suppressClick=false;ev.preventDefault();ev.stopImmediatePropagation();}},true);
  cv.addEventListener('dblclick',function(ev){if(performance.now()-lastDrag<600){ev.preventDefault();ev.stopImmediatePropagation();}},true);
  cv.addEventListener('contextmenu',function(ev){if(performance.now()-lastDrag<600){ev.preventDefault();ev.stopImmediatePropagation();}},true);
  cv.addEventListener('wheel',function(ev){if(!canView() || modalOpen() || ev.ctrlKey || ev.metaKey) return;ev.preventDefault();pose().zoom*=Math.exp(-ev.deltaY*.001);changed();},{passive:false});
  $('cameraReset').addEventListener('click',resetView);
  $('cameraZoomOut').addEventListener('click',function(){pose().zoom/=1.16;changed();});
  $('cameraZoomIn').addEventListener('click',function(){pose().zoom*=1.16;changed();});
  window.addEventListener('keydown',function(ev){
    var target=ev.target,tag=target && target.tagName;
    if(!canView() || modalOpen() || ev.altKey || ev.ctrlKey || ev.metaKey || (target && target.isContentEditable) || ['INPUT','TEXTAREA','SELECT'].indexOf(tag)!==-1) return;
    var p=pose();
    if(ev.key==='ArrowLeft')p.yaw+=.09;else if(ev.key==='ArrowRight')p.yaw-=.09;else if(ev.key==='ArrowUp')p.pitch+=.07;else if(ev.key==='ArrowDown')p.pitch-=.07;else if(ev.key==='Home'){ev.preventDefault();resetView();return;}else return;
    ev.preventDefault();changed();
  });
  window.JEU.nouvellePartie=window.nouvellePartie;
  window.JEU.debug=function(){return {L:L,project:project,cam:cameraActive(),camera:{yaw:pose().yaw,pitch:pose().pitch,zoom:pose().zoom},hits:hits};};
  window.JEU.orbit={getCamera:function(){return {yaw:pose().yaw,pitch:pose().pitch,zoom:pose().zoom};},reset:resetView};
  labels();redessiner();
})();
